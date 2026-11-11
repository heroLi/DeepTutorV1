// One video, two sets of controls: native media events remain the source of truth.
export function attachVideoControls({video, source, backward, toggle, forward, icon, label, time, status, error}) {
  const listeners = [];
  let disposed = false, pending = false, request = 0, sourceFailed = false, playError = '', buffering = false;
  const listen = (target, event, handler) => {
    if (!target) return;
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  };
  const clock = value => {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };
  const state = () => {
    const duration = video.duration;
    const failed = sourceFailed || Boolean(video.error);
    const ready = !failed && video.readyState >= 1 && Number.isFinite(duration) && duration > 0;
    const position = ready ? Math.min(duration, Math.max(0, Number.isFinite(video.currentTime) ? video.currentTime : 0)) : 0;
    const ended = ready && (video.ended || position >= duration);
    const active = ready && !ended && (pending || !video.paused);
    return {duration, failed, ready, position, ended, active};
  };
  const announce = text => {
    if (!disposed && status.textContent !== text) status.textContent = text;
  };
  function sync(announceState = true) {
    if (disposed) return;
    const s = state();
    toggle.disabled = !s.ready;
    backward.disabled = !s.ready || s.position <= 0;
    forward.disabled = !s.ready || s.ended;
    label.textContent = s.ended ? '再看一次' : s.active ? '暂停' : '播放';
    icon.textContent = s.ended ? '↻' : '';
    toggle.setAttribute('aria-label', s.ended ? '重新播放视频' : s.active ? '暂停视频' : '播放视频');
    toggle.dataset.state = s.ended ? 'ended' : s.active ? 'playing' : 'paused';
    time.textContent = `${clock(s.position)} / ${s.ready ? clock(s.duration) : '--:--'}`;
    error.hidden = !s.failed;
    if (announceState) announce(s.failed ? '视频暂时无法播放。' : !s.ready ? '正在准备视频…' : playError || (s.ended ? '播放完啦，可以点「再看一次」。' : buffering && s.active ? '正在缓冲，稍等一下。' : pending ? '正在准备播放，可以点暂停。' : s.active ? '正在播放，想一想时可以暂停。' : s.position > 0 ? '已暂停，可以继续播放。' : '准备好啦，点「播放」开始。'));
  }
  function cancelPending() { pending = false; request += 1; }
  async function togglePlayback() {
    const s = state();
    if (disposed || !s.ready) return;
    playError = '';
    if (s.active) {
      cancelPending();
      buffering = false;
      video.pause();
      sync();
      return;
    }
    const thisRequest = ++request;
    pending = true;
    sync();
    try {
      if (s.ended) video.currentTime = 0;
      await video.play();
      if (disposed || thisRequest !== request) return;
      pending = false;
      sync();
    } catch {
      if (disposed || thisRequest !== request) return;
      pending = false;
      buffering = false;
      playError = '还没能播放，请再点一次「播放」，或使用视频里的播放键。';
      sync();
    }
  }
  function seekBy(seconds) {
    const s = state();
    if (disposed || !s.ready) return;
    const target = Math.min(s.duration, Math.max(0, s.position + seconds));
    if (target === s.position) return;
    playError = '';
    try {
      video.currentTime = target;
      sync(false);
      announce(target === 0 ? '已回到开头。' : target === s.duration ? '已到视频结尾，可以点「再看一次」。' : `已${seconds < 0 ? '快退' : '快进'} 5 秒。`);
    } catch {
      announce('暂时无法跳转，请用视频里的进度条试试。');
    }
  }
  listen(toggle, 'click', togglePlayback);
  listen(backward, 'click', () => seekBy(-5));
  listen(forward, 'click', () => seekBy(5));
  listen(video, 'play', () => { playError = ''; sync(); });
  listen(video, 'playing', () => { pending = false; buffering = false; playError = ''; sync(); });
  listen(video, 'pause', () => {
    if (video.paused) { cancelPending(); buffering = false; }
    sync();
  });
  listen(video, 'ended', () => { cancelPending(); buffering = false; sync(); });
  for (const event of ['loadedmetadata', 'durationchange', 'canplay']) listen(video, event, () => {
    if (video.readyState >= 1 && !video.error) sourceFailed = false;
    sync();
  });
  // The visible clock and boundary buttons update without a live announcement on every frame.
  for (const event of ['timeupdate', 'seeking', 'seeked']) listen(video, event, () => sync(false));
  for (const event of ['waiting', 'stalled']) listen(video, event, () => { buffering = true; sync(); });
  for (const event of ['emptied', 'loadstart']) listen(video, event, () => {
    cancelPending(); sourceFailed = false; playError = ''; buffering = false; sync();
  });
  const fail = () => { cancelPending(); sourceFailed = true; buffering = false; sync(); };
  listen(video, 'error', fail);
  listen(source, 'error', fail);
  sync();
  return () => {
    disposed = true;
    cancelPending();
    listeners.forEach(remove => remove());
    video.pause();
  };
}
