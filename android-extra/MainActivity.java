package com.lixander.beatwave;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
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
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false); // la app se dibuja bajo las barras
        if (Build.VERSION.SDK_INT >= 28) { // y también bajo la muesca / cámara
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);

        final View root = findViewById(android.R.id.content);
        root.setBackgroundColor(Color.parseColor("#0D0D11"));
        // Nada de márgenes por las barras: el contenido no se encoge ni se mueve cuando las barras aparecen.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> insets);
        hideBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    private void hideBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}