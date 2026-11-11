import test from 'node:test';
import assert from 'node:assert/strict';
import {attachVideoControls} from '../dist/video-controls.js';

class Node extends EventTarget {
  constructor() { super(); this.textContent = ''; this.disabled = false; this.hidden = true; this.dataset = {}; this.attributes = {}; }
  setAttribute(key, value) { this.attributes[key] = value; }
  emit(type) { this.dispatchEvent(new Event(type)); }
  click() { if (!this.disabled) this.emit('click'); }
}
class Media extends Node {
  constructor() { super(); this.duration = NaN; this.readyState = 0; this.paused = true; this.ended = false; this.error = null; this.position = 0; this.playCalls = 0; this.pauseCalls = 0; }
  get currentTime() { return this.position; }
  set currentTime(value) {
    if (this.throwSeek) throw new Error('seek unavailable');
    this.position = value; this.ended = false;
    this.emit('seeking'); this.emit('timeupdate'); this.emit('seeked');
  }
  load(duration = 69.273243) { this.duration = duration; this.readyState = 1; this.emit('loadedmetadata'); }
  play() { this.playCalls++; this.paused = false; this.emit('play'); this.emit('playing'); return Promise.resolve(); }
  pause() { this.pauseCalls++; this.paused = true; this.emit('pause'); }
}
function setup(loaded = true) {
  const controls = Object.fromEntries(['source', 'backward', 'toggle', 'forward', 'icon', 'label', 'time', 'status', 'error'].map(key => [key, new Node()]));
  controls.video = new Media();
  controls.dispose = attachVideoControls(controls);
  if (loaded) controls.video.load();
  return controls;
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

test('controls wait for finite nonzero metadata, then enable only available actions', () => {
  const c = setup(false);
  for (const button of [c.toggle, c.backward, c.forward]) assert.equal(button.disabled, true);
  c.toggle.click(); assert.equal(c.video.playCalls, 0);
  for (const invalid of [NaN, Infinity, 0, -1]) {
    c.video.load(invalid);
    assert.equal(c.toggle.disabled, true);
    assert.equal(c.forward.disabled, true);
  }
  c.video.load();
  assert.equal(c.toggle.disabled, false);
  assert.equal(c.backward.disabled, true);
  assert.equal(c.forward.disabled, false);
  assert.equal(c.time.textContent, '00:00 / 01:09');
  assert.equal(c.label.textContent, '播放');
});

test('large play and pause buttons control the media and accessible action labels', async () => {
  const c = setup();
  c.toggle.click(); await tick();
  assert.equal(c.video.playCalls, 1); assert.equal(c.video.paused, false);
  assert.equal(c.label.textContent, '暂停'); assert.equal(c.toggle.attributes['aria-label'], '暂停视频');
  assert.equal(c.toggle.dataset.state, 'playing'); assert.equal(c.icon.textContent, '');
  c.toggle.click();
  assert.equal(c.video.paused, true); assert.equal(c.video.pauseCalls, 1);
  assert.equal(c.label.textContent, '播放'); assert.equal(c.toggle.attributes['aria-label'], '播放视频');
  assert.equal(c.toggle.dataset.state, 'paused'); assert.equal(c.icon.textContent, '');
});

test('five-second jumps clamp at zero and the exact fractional duration', () => {
  const c = setup();
  c.forward.click(); assert.equal(c.video.currentTime, 5);
  c.forward.click(); assert.equal(c.video.currentTime, 10);
  c.backward.click(); assert.equal(c.video.currentTime, 5);
  c.video.currentTime = 2;
  c.backward.click(); assert.equal(c.video.currentTime, 0); assert.equal(c.backward.disabled, true);
  c.backward.click(); assert.equal(c.video.currentTime, 0);
  assert.equal(c.status.textContent, '已回到开头。');
  c.video.currentTime = 67;
  c.forward.click(); assert.equal(c.video.currentTime, c.video.duration); assert.equal(c.forward.disabled, true);
  c.forward.click(); assert.equal(c.video.currentTime, c.video.duration);
  assert.equal(c.label.textContent, '再看一次');
  c.backward.click(); assert.equal(c.video.currentTime, c.video.duration - 5); assert.equal(c.forward.disabled, false);
});

test('native controls and ended events synchronize the large buttons; replay starts at zero', async () => {
  const c = setup();
  c.video.play(); assert.equal(c.label.textContent, '暂停');
  c.video.pause(); assert.equal(c.label.textContent, '播放');
  c.video.currentTime = c.video.duration;
  c.video.paused = true; c.video.ended = true; c.video.emit('ended');
  assert.equal(c.label.textContent, '再看一次'); assert.equal(c.toggle.attributes['aria-label'], '重新播放视频');
  assert.equal(c.toggle.dataset.state, 'ended'); assert.equal(c.icon.textContent, '↻');
  c.toggle.click(); await tick();
  assert.equal(c.video.currentTime, 0); assert.equal(c.video.paused, false); assert.equal(c.label.textContent, '暂停');
});

test('promise rejection and synchronous play errors are handled and allow a retry', async () => {
  for (const rejected of [true, false]) {
    const c = setup();
    c.video.play = () => { if (rejected) return Promise.reject(new Error('blocked')); throw new Error('unsupported'); };
    c.toggle.click(); await tick();
    assert.equal(c.label.textContent, '播放'); assert.equal(c.toggle.disabled, false);
    assert.match(c.status.textContent, /还没能播放/);
    c.video.play = Media.prototype.play;
    c.toggle.click(); await tick();
    assert.equal(c.label.textContent, '暂停'); assert.doesNotMatch(c.status.textContent, /还没能播放/);
  }
});

test('repeat click cancels pending play without duplicate requests or stale error feedback', async () => {
  const c = setup(); let reject;
  c.video.play = () => { c.video.playCalls++; return new Promise((_, rejectPromise) => { reject = rejectPromise; }); };
  c.toggle.click(); assert.equal(c.label.textContent, '暂停');
  c.toggle.click(); assert.equal(c.label.textContent, '播放'); assert.equal(c.video.playCalls, 1);
  reject(new Error('interrupted by pause')); await tick();
  assert.doesNotMatch(c.status.textContent, /还没能播放/); assert.equal(c.label.textContent, '播放');
});

test('native pause invalidates pending play, and old promises cannot replace a newer state', async () => {
  const c = setup(); let reject;
  c.video.play = () => { c.video.paused = false; c.video.emit('play'); return new Promise((_, no) => { reject = no; }); };
  c.toggle.click();
  c.video.pause();
  c.video.play = Media.prototype.play;
  c.toggle.click(); await tick();
  reject(new Error('older attempt')); await tick();
  assert.equal(c.label.textContent, '暂停'); assert.doesNotMatch(c.status.textContent, /还没能播放/);
});

test('media/source errors disable custom controls; reloaded metadata restores them', () => {
  for (const target of ['video', 'source']) {
    const c = setup();
    if (target === 'video') c.video.error = {code: 3};
    c[target].emit('error');
    assert.equal(c.error.hidden, false);
    for (const button of [c.toggle, c.backward, c.forward]) assert.equal(button.disabled, true);
    c.video.readyState = 0; c.video.error = null; c.video.emit('emptied'); c.video.load();
    assert.equal(c.error.hidden, true); assert.equal(c.toggle.disabled, false);
  }
});

test('clock and boundary state follow native seeking without repeated live announcements', () => {
  const c = setup();
  c.video.play(); const before = c.status.textContent;
  for (const position of [1, 10, 20, 30]) {
    c.video.currentTime = position;
    assert.equal(c.status.textContent, before);
  }
  assert.equal(c.time.textContent, '00:30 / 01:09'); assert.equal(c.backward.disabled, false);
  c.video.emit('waiting'); assert.match(c.status.textContent, /缓冲/);
  c.video.emit('playing'); assert.equal(c.status.textContent, before);
});

test('a seek failure is visible and does not break subsequent controls', async () => {
  const c = setup(); c.video.throwSeek = true;
  c.forward.click(); assert.match(c.status.textContent, /暂时无法跳转/); assert.equal(c.video.currentTime, 0);
  c.video.throwSeek = false; c.forward.click(); assert.equal(c.video.currentTime, 5);
  c.toggle.click(); await tick(); assert.equal(c.video.paused, false);
});

test('cleanup stops playback, detaches listeners and ignores pending promise outcomes', async () => {
  const c = setup(); let reject;
  c.video.play = () => new Promise((_, no) => { reject = no; });
  c.toggle.click(); c.dispose();
  assert.equal(c.video.paused, true); assert.equal(c.video.pauseCalls, 1);
  const before = c.status.textContent;
  reject(new Error('removed video')); await tick();
  c.video.emit('error'); c.video.emit('playing'); c.forward.click();
  assert.equal(c.status.textContent, before); assert.equal(c.video.currentTime, 0);
});
