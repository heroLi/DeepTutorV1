"""The entire suite uses synthetic data and must not open outbound sockets."""
import socket
import pytest

@pytest.fixture(autouse=True)
def no_outbound(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError('Outbound network is forbidden in offline tests')
    monkeypatch.setattr(socket.socket, 'connect', blocked)
    monkeypatch.setattr(socket.socket, 'connect_ex', blocked)
    monkeypatch.setattr(socket, 'create_connection', blocked)
