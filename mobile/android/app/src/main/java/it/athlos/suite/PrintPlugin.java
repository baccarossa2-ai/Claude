package it.athlos.suite;

import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PdfPrinter;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.HashSet;
import java.util.Set;

/**
 * Stampa reale da Android: il documento HTML viene impaginato in una WebView nascosta
 * e passato al servizio di stampa di sistema (stampanti Wi-Fi, Bluetooth, Mopria, "Salva come PDF"),
 * oppure scritto direttamente in un PDF da condividere.
 */
@CapacitorPlugin(name = "AthlosPrint")
public class PrintPlugin extends Plugin {

    private static final String ASSETS = "file:///android_asset/public/";
    private final Set<WebView> alive = new HashSet<>();

    interface Ready {
        void run(WebView view);
    }

    static PrintAttributes.MediaSize mediaSize(String paper, boolean landscape) {
        PrintAttributes.MediaSize m;
        switch (paper == null ? "A4" : paper) {
            case "A5":
                m = PrintAttributes.MediaSize.ISO_A5;
                break;
            case "Letter":
                m = PrintAttributes.MediaSize.NA_LETTER;
                break;
            case "Termica 80mm":
                m = new PrintAttributes.MediaSize("ATHLOS_80", "Termica 80 mm", 3150, 11693);
                break;
            case "Termica 58mm":
                m = new PrintAttributes.MediaSize("ATHLOS_58", "Termica 58 mm", 2283, 11693);
                break;
            default:
                m = PrintAttributes.MediaSize.ISO_A4;
        }
        return landscape ? m.asLandscape() : m.asPortrait();
    }

    // Gli indirizzi dell'app (https://localhost/…) diventano file locali leggibili dalla WebView nascosta
    static String localize(String html) {
        return html.replace("https://localhost/_capacitor_file_/", "file:///").replace("https://localhost/", ASSETS);
    }

    private void render(final String html, final Ready ready) {
        getActivity().runOnUiThread(() -> {
            final WebView wv = new WebView(getContext());
            WebSettings s = wv.getSettings();
            s.setJavaScriptEnabled(false);
            s.setAllowFileAccess(true);
            alive.add(wv);
            wv.setWebViewClient(new WebViewClient() {
                private boolean done = false;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (done) return;
                    done = true;
                    // lascia il tempo a caratteri e immagini di essere applicati
                    new Handler(Looper.getMainLooper()).postDelayed(() -> ready.run(view), 300);
                }
            });
            wv.loadDataWithBaseURL(ASSETS, localize(html), "text/html", "UTF-8", null);
        });
    }

    private void release(WebView wv) {
        getActivity().runOnUiThread(() -> {
            alive.remove(wv);
            wv.destroy();
        });
    }

    @PluginMethod
    public void print(final PluginCall call) {
        final String html = call.getString("html", "");
        final String job = call.getString("jobName", "Athlos");
        final PrintAttributes attrs = new PrintAttributes.Builder()
            .setMediaSize(mediaSize(call.getString("paper"), Boolean.TRUE.equals(call.getBoolean("landscape", false))))
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .build();
        render(html, wv -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                pm.print(job, new Releasing(wv.createPrintDocumentAdapter(job), () -> release(wv)), attrs);
                JSObject r = new JSObject();
                r.put("ok", true);
                call.resolve(r);
            } catch (Exception e) {
                release(wv);
                call.reject("Stampa non disponibile: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void pdf(final PluginCall call) {
        final String html = call.getString("html", "");
        String name = call.getString("fileName", "documento.pdf").replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
        final File dir = new File(getContext().getCacheDir(), "pdf");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        final File out = new File(dir, name);
        final PrintAttributes attrs = new PrintAttributes.Builder()
            .setMediaSize(mediaSize(call.getString("paper"), Boolean.TRUE.equals(call.getBoolean("landscape", false))))
            .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 600, 600))
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .build();
        render(html, wv -> {
            try {
                PdfPrinter.write(wv.createPrintDocumentAdapter(out.getName()), attrs, out, new PdfPrinter.Callback() {
                    @Override
                    public void onDone(File file) {
                        release(wv);
                        JSObject r = new JSObject();
                        r.put("path", file.getAbsolutePath());
                        r.put("uri", Uri.fromFile(file).toString());
                        call.resolve(r);
                    }

                    @Override
                    public void onError(String message) {
                        release(wv);
                        call.reject(message);
                    }
                });
            } catch (Throwable e) {
                release(wv);
                call.reject("PDF non disponibile su questo telefono: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        for (WebView wv : alive) wv.destroy();
        alive.clear();
    }

    /** Inoltra al documento della WebView e libera la WebView a stampa conclusa. */
    static final class Releasing extends PrintDocumentAdapter {
        private final PrintDocumentAdapter inner;
        private final Runnable onEnd;

        Releasing(PrintDocumentAdapter inner, Runnable onEnd) {
            this.inner = inner;
            this.onEnd = onEnd;
        }

        @Override
        public void onStart() {
            inner.onStart();
        }

        @Override
        public void onLayout(PrintAttributes oldA, PrintAttributes newA, CancellationSignal cs, LayoutResultCallback cb, Bundle extras) {
            inner.onLayout(oldA, newA, cs, cb, extras);
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor dest, CancellationSignal cs, WriteResultCallback cb) {
            inner.onWrite(pages, dest, cs, cb);
        }

        @Override
        public void onFinish() {
            inner.onFinish();
            onEnd.run();
        }
    }
}
