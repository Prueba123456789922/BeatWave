package com.lixander.beatwave;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Reemplaza el MainActivity.java que crea Capacitor (lo hace tools/patch-android.js).
// - El sonido de bienvenida suena al abrir, sin esperar un toque.
// - PANTALLA COMPLETA de verdad: el juego ocupa toda la pantalla (también detrás de la muesca/cámara) y las barras del sistema
//   están ocultas. Si deslizas desde el borde para sacar la barra de estado o los botones de navegación, aparecen ENCIMA del juego
//   un momento y se esconden solas, sin mover ni encoger nada.
public class MainActivity extends BridgeActivity {
    private String lastInsetsJs = null;

    private void sendInsets() {
        if (lastInsetsJs != null) getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(lastInsetsJs, null));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED, WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        getBridge().getWebView().setLayerType(View.LAYER_TYPE_HARDWARE, null);
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= 28) { // el juego se dibuja también bajo la muesca / cámara
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        findViewById(android.R.id.content).setBackgroundColor(Color.parseColor("#0D0D11"));

        // Le pasamos al juego los márgenes reales de la muesca y las esquinas (en px de CSS) para que no se recorte nada.
        // No se consumen los insets: Capacitor sigue manejando todo lo demás como siempre.
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float d = getResources().getDisplayMetrics().density;
            lastInsetsJs = "(function(){var s=document.documentElement.style;s.setProperty('--bw-top','" + Math.round(b.top / d) + "px');s.setProperty('--bw-bottom','" + Math.round(b.bottom / d) + "px');s.setProperty('--bw-left','" + Math.round(b.left / d) + "px');s.setProperty('--bw-right','" + Math.round(b.right / d) + "px');})();";
            sendInsets();
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
        for (int ms : new int[]{600, 1800, 4000}) getBridge().getWebView().postDelayed(this::sendInsets, ms); // por si la página aún no había cargado
        hideBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) { hideBars(); sendInsets(); }
    }

    private void hideBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}