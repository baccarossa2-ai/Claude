package it.athlos.suite;

import android.content.Context;
import android.net.wifi.WifiManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rete locale per la chat Squadra: scoperta delle postazioni in UDP (multicast + broadcast)
 * e messaggi in TCP a righe JSON, lo stesso protocollo dei PC. La logica della chat è in JavaScript.
 */
@CapacitorPlugin(name = "AthlosLan")
public class LanPlugin extends Plugin {

    private static final String GROUP = "239.255.47.80";

    private final ExecutorService io = Executors.newCachedThreadPool();
    private final Map<Integer, Socket> sockets = new ConcurrentHashMap<>();
    private final Map<Integer, ExecutorService> writers = new ConcurrentHashMap<>();
    private final AtomicInteger seq = new AtomicInteger(1);
    private volatile MulticastSocket udp;
    private volatile ServerSocket server;
    private WifiManager.MulticastLock lock;

    // ------------------------------------------------------------------ interfacce
    @PluginMethod
    public void netInfo(PluginCall call) {
        JSArray list = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    if (!(ia.getAddress() instanceof Inet4Address)) continue;
                    JSObject o = new JSObject();
                    o.put("name", ni.getName());
                    o.put("address", ia.getAddress().getHostAddress());
                    o.put("netmask", mask(ia.getNetworkPrefixLength()));
                    list.put(o);
                }
            }
        } catch (Exception ignored) {
            // nessuna rete
        }
        JSObject r = new JSObject();
        r.put("interfaces", list);
        call.resolve(r);
    }

    private static String mask(int prefix) {
        int m = prefix <= 0 ? 0 : 0xFFFFFFFF << (32 - Math.min(prefix, 32));
        return ((m >>> 24) & 255) + "." + ((m >>> 16) & 255) + "." + ((m >>> 8) & 255) + "." + (m & 255);
    }

    // ------------------------------------------------------------------ UDP
    @PluginMethod
    public void udpBind(final PluginCall call) {
        final int port = call.getInt("port", 47800);
        io.execute(() -> {
            final MulticastSocket s;
            try {
                closeUdp();
                acquireLock();
                s = new MulticastSocket(null);
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(port));
                s.setBroadcast(true);
                s.setTimeToLive(2);
                joinGroup(s, port);
                udp = s;
            } catch (Exception e) {
                call.reject("Rete non disponibile: " + e.getMessage());
                return;
            }
            call.resolve();
            byte[] buf = new byte[65535];
            while (!s.isClosed()) {
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    s.receive(p);
                    JSObject ev = new JSObject();
                    ev.put("data", new String(p.getData(), p.getOffset(), p.getLength(), StandardCharsets.UTF_8));
                    ev.put("address", p.getAddress().getHostAddress());
                    ev.put("port", p.getPort());
                    notifyListeners("udpMessage", ev);
                } catch (Exception e) {
                    if (s.isClosed()) break;
                }
            }
        });
    }

    private void joinGroup(MulticastSocket s, int port) {
        boolean joined = false;
        try {
            InetSocketAddress group = new InetSocketAddress(InetAddress.getByName(GROUP), port);
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                try {
                    if (!ni.isUp() || ni.isLoopback() || !ni.supportsMulticast()) continue;
                    s.joinGroup(group, ni);
                    joined = true;
                } catch (Exception ignored) {
                    // interfaccia senza multicast
                }
            }
            if (!joined) s.joinGroup(InetAddress.getByName(GROUP));
        } catch (Exception ignored) {
            // resta il broadcast
        }
    }

    @PluginMethod
    public void udpSend(final PluginCall call) {
        final String data = call.getString("data", "");
        final String address = call.getString("address", GROUP);
        final int port = call.getInt("port", 47800);
        io.execute(() -> {
            MulticastSocket s = udp;
            if (s == null || s.isClosed()) {
                call.reject("UDP non attivo");
                return;
            }
            try {
                byte[] d = data.getBytes(StandardCharsets.UTF_8);
                s.send(new DatagramPacket(d, d.length, InetAddress.getByName(address), port));
                call.resolve();
            } catch (Exception e) {
                call.reject("Invio non riuscito: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void udpClose(PluginCall call) {
        closeUdp();
        call.resolve();
    }

    private void closeUdp() {
        MulticastSocket s = udp;
        udp = null;
        if (s != null) s.close();
        releaseLock();
    }

    private synchronized void acquireLock() {
        if (lock == null) {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm == null) return;
            lock = wm.createMulticastLock("athlos-squadra");
            lock.setReferenceCounted(false);
        }
        if (!lock.isHeld()) lock.acquire();
    }

    private synchronized void releaseLock() {
        if (lock != null && lock.isHeld()) lock.release();
    }

    // ------------------------------------------------------------------ TCP
    @PluginMethod
    public void tcpListen(final PluginCall call) {
        final int port = call.getInt("port", 47801);
        io.execute(() -> {
            final ServerSocket ss;
            try {
                closeServer();
                ss = new ServerSocket();
                ss.setReuseAddress(true);
                ss.bind(new InetSocketAddress(port));
                server = ss;
            } catch (java.net.BindException e) {
                call.reject("Porta in use: " + e.getMessage());
                return;
            } catch (IOException e) {
                call.reject("Rete non disponibile: " + e.getMessage());
                return;
            }
            JSObject r = new JSObject();
            r.put("port", ss.getLocalPort());
            call.resolve(r);
            while (!ss.isClosed()) {
                try {
                    Socket c = ss.accept();
                    int id = register(c);
                    JSObject ev = new JSObject();
                    ev.put("id", id);
                    ev.put("address", c.getInetAddress().getHostAddress());
                    notifyListeners("tcpConnection", ev);
                    read(id, c);
                } catch (Exception e) {
                    if (ss.isClosed()) break;
                }
            }
        });
    }

    @PluginMethod
    public void tcpServerClose(PluginCall call) {
        closeServer();
        call.resolve();
    }

    private void closeServer() {
        ServerSocket ss = server;
        server = null;
        if (ss != null) {
            try { ss.close(); } catch (IOException ignored) { /* già chiuso */ }
        }
    }

    @PluginMethod
    public void tcpConnect(final PluginCall call) {
        final String host = call.getString("host");
        final int port = call.getInt("port", 47801);
        final int timeout = call.getInt("timeout", 5000);
        if (host == null) {
            call.reject("Indirizzo mancante");
            return;
        }
        io.execute(() -> {
            Socket c = new Socket();
            try {
                c.connect(new InetSocketAddress(host, port), timeout);
                c.setKeepAlive(true);
                c.setTcpNoDelay(true);
            } catch (Exception e) {
                try { c.close(); } catch (IOException ignored) { /* non aperto */ }
                call.reject("Connessione non riuscita: " + e.getMessage());
                return;
            }
            int id = register(c);
            JSObject r = new JSObject();
            r.put("id", id);
            call.resolve(r);
            read(id, c);
        });
    }

    @PluginMethod
    public void tcpWrite(final PluginCall call) {
        final int id = call.getInt("id", -1);
        final String data = call.getString("data", "");
        final Socket c = sockets.get(id);
        final ExecutorService w = writers.get(id);
        if (c == null || w == null) {
            call.reject("Connessione chiusa");
            return;
        }
        // un esecutore per connessione: le righe partono nell'ordine in cui sono state scritte
        w.execute(() -> {
            try {
                OutputStream out = c.getOutputStream();
                out.write(data.getBytes(StandardCharsets.UTF_8));
                out.flush();
                call.resolve();
            } catch (Exception e) {
                close(id);
                call.reject("Scrittura non riuscita: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void tcpClose(PluginCall call) {
        close(call.getInt("id", -1));
        call.resolve();
    }

    private int register(Socket c) {
        int id = seq.getAndIncrement();
        sockets.put(id, c);
        writers.put(id, Executors.newSingleThreadExecutor());
        return id;
    }

    private void read(final int id, final Socket c) {
        io.execute(() -> {
            try (InputStreamReader in = new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8)) {
                char[] buf = new char[65536];
                int n;
                while ((n = in.read(buf)) > 0) {
                    JSObject ev = new JSObject();
                    ev.put("id", id);
                    ev.put("data", new String(buf, 0, n));
                    notifyListeners("tcpData", ev);
                }
            } catch (Exception ignored) {
                // connessione interrotta
            } finally {
                close(id);
                JSObject ev = new JSObject();
                ev.put("id", id);
                notifyListeners("tcpClose", ev);
            }
        });
    }

    private void close(int id) {
        Socket c = sockets.remove(id);
        ExecutorService w = writers.remove(id);
        if (w != null) w.shutdown();
        if (c != null) {
            try { c.close(); } catch (IOException ignored) { /* già chiusa */ }
        }
    }

    @Override
    protected void handleOnDestroy() {
        closeUdp();
        closeServer();
        for (Integer id : sockets.keySet()) close(id);
        io.shutdownNow();
    }
}
