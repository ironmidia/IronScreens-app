package com.ironmidia.ironscreens

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager

/**
 * Mantém uma janela de overlay mínima (1x1px, transparente, não-tocável)
 * enquanto o app roda. Isso é puramente um efeito colateral: o Android, a
 * partir do Android 10+, bloqueia silenciosamente qualquer tentativa de um
 * app se relançar a partir de segundo plano (proteção anti-abuso contra
 * apps sequestrando o botão Home) — EXCETO quando o app mantém uma janela
 * visível ativa (TYPE_APPLICATION_OVERLAY), que é justamente uma das
 * exceções documentadas dessa restrição.
 *
 * Sem essa janela, o onUserLeaveHint()+startActivity() do MainActivity.kt
 * (tentativa de reabrir o app ao apertar Home/Recentes) é ignorado pelo
 * sistema sem erro nenhum. Com ela, o app conta como "tendo uma janela
 * visível" e o relançamento volta a funcionar.
 *
 * Depende da permissão SYSTEM_ALERT_WINDOW estar de fato CONCEDIDA pelo
 * usuário nas Configurações — sem isso, `canDrawOverlays` retorna false e
 * o serviço simplesmente não faz nada (sem crash).
 */
class OverlayKeepAliveService : Service() {

  companion object {
    private const val TAG = "IronScreens/OverlayKeepAlive"
  }

  private var windowManager: WindowManager? = null
  private var overlayView: View? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    addOverlay()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (overlayView == null) addOverlay()
    return START_STICKY
  }

  private fun addOverlay() {
    if (!Settings.canDrawOverlays(this)) {
      Log.i(TAG, "Permissão de sobreposição não concedida — nada a fazer")
      return
    }

    try {
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
      }

      val params = WindowManager.LayoutParams(
        1,
        1,
        type,
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
      ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = 0
        y = 0
      }

      val view = View(this)
      windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
      windowManager?.addView(view, params)
      overlayView = view
      Log.i(TAG, "Overlay mínimo adicionado com sucesso")
    } catch (e: Exception) {
      Log.e(TAG, "Falha ao adicionar overlay", e)
    }
  }

  override fun onDestroy() {
    try {
      overlayView?.let { windowManager?.removeView(it) }
    } catch (e: Exception) {
      // Ignora — a view pode já não estar mais anexada.
    }
    overlayView = null
    super.onDestroy()
  }
}
