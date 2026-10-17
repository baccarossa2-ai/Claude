package it.athlos.suite;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(LanPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
