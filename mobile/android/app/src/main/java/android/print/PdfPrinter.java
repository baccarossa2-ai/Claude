package android.print;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import java.io.File;

/**
 * Scrive su file il documento di una WebView senza aprire la finestra di stampa.
 * Sta nel package android.print perché i callback di layout e scrittura hanno
 * costruttori visibili solo dentro questo package.
 */
public final class PdfPrinter {

    public interface Callback {
        void onDone(File file);
        void onError(String message);
    }

    private PdfPrinter() {}

    public static void write(final PrintDocumentAdapter adapter, final PrintAttributes attrs, final File out, final Callback cb) {
        adapter.onStart();
        adapter.onLayout(null, attrs, new CancellationSignal(), new PrintDocumentAdapter.LayoutResultCallback() {
            @Override
            public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                final ParcelFileDescriptor pfd;
                try {
                    pfd = ParcelFileDescriptor.open(out, ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE | ParcelFileDescriptor.MODE_READ_WRITE);
                } catch (Exception e) {
                    adapter.onFinish();
                    cb.onError("File non scrivibile: " + e.getMessage());
                    return;
                }
                adapter.onWrite(new PageRange[] { PageRange.ALL_PAGES }, pfd, new CancellationSignal(), new PrintDocumentAdapter.WriteResultCallback() {
                    @Override
                    public void onWriteFinished(PageRange[] pages) {
                        close(pfd);
                        adapter.onFinish();
                        cb.onDone(out);
                    }

                    @Override
                    public void onWriteFailed(CharSequence error) {
                        close(pfd);
                        adapter.onFinish();
                        cb.onError("PDF non creato: " + error);
                    }

                    @Override
                    public void onWriteCancelled() {
                        close(pfd);
                        adapter.onFinish();
                        cb.onError("PDF annullato");
                    }
                });
            }

            @Override
            public void onLayoutFailed(CharSequence error) {
                adapter.onFinish();
                cb.onError("Impaginazione non riuscita: " + error);
            }

            @Override
            public void onLayoutCancelled() {
                adapter.onFinish();
                cb.onError("PDF annullato");
            }
        }, new Bundle());
    }

    private static void close(ParcelFileDescriptor pfd) {
        try { pfd.close(); } catch (Exception ignored) { /* già chiuso */ }
    }
}
