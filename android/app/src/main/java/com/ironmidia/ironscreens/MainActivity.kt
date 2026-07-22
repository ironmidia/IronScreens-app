package com.ironmidia.ironscreens
import expo.modules.splashscreen.SplashScreenManager

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.widget.EditText

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)

    // ─── Mantém uma janelinha de overlay ativa (ver OverlayKeepAliveService)
    // pra contar como "app com janela visível" e não ser bloqueado pela
    // restrição de background activity start do Android 10+ quando
    // onUserLeaveHint() tenta se relançar após Home/Recentes. No-op se a
    // permissão de sobreposição não estiver concedida.
    try {
      startService(Intent(this, OverlayKeepAliveService::class.java))
    } catch (e: Exception) {
      // Ignora — pior caso é o app não conseguir se relançar sozinho.
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  // ─── Modo quiosque "melhor esforço" (sem Device Owner) ─────────────────────
  // Sem provisionar a caixa como Device Owner (exige ADB numa caixa zerada),
  // não dá pra bloquear Home/Recentes de verdade — o Android reserva essas
  // teclas pro sistema antes mesmo de chegar no app. O paliativo possível:
  // onUserLeaveHint() é chamado bem antes da Activity ir pra segundo plano
  // por causa do usuário apertar Home/Recentes/trocar de app — nesse
  // instante relançamos a própria Activity por cima. Não impede o usuário
  // de ver a tela de Recentes/Home por uma fração de segundo, mas traz o
  // app de volta imediatamente em vez de deixar ele "escapar".
  // O botão Voltar físico NÃO passa por aqui (fica só no BackHandler do JS).
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    try {
      val intent = Intent(this, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      startActivity(intent)
    } catch (e: Exception) {
      // Ignora silenciosamente — pior caso é o usuário conseguir sair uma vez.
    }
  }

  // ─── Ponte de teclas do controle remoto (D-pad) pro JS ────────────────────
  // Boxes Android genéricas (não Android TV/Leanback) mapeiam o controle
  // físico pra eventos de tecla padrão do Android (KEYCODE_DPAD_*). O React
  // Native puro não expõe isso nem faz o Pressable ser focável nativamente,
  // então repassamos manualmente via DeviceEventEmitter — a navegação em si
  // (qual item está em foco, mover com as setas, "clicar" com OK) é
  // implementada em JS (ver hooks/useDpadNavigation.ts).
  private val DPAD_EVENT_NAME = "IronScreensDpadEvent"

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    // ─── Quando o foco está num campo de texto nativo (ex: o PIN do
    // terminal), deixa o Android tratar a tecla do jeito normal dele —
    // é esse comportamento padrão (clique/OK abrindo o teclado, setas
    // movendo o cursor) que fica quebrado se a gente consumir o evento
    // aqui. A correção do toggle duplicado (ver comentário abaixo) só
    // vale pra quando o foco está em outro tipo de elemento (Pressable).
    if (currentFocus is EditText) {
      return super.dispatchKeyEvent(event)
    }

    val keyName = when (event.keyCode) {
      KeyEvent.KEYCODE_DPAD_UP -> "UP"
      KeyEvent.KEYCODE_DPAD_DOWN -> "DOWN"
      KeyEvent.KEYCODE_DPAD_LEFT -> "LEFT"
      KeyEvent.KEYCODE_DPAD_RIGHT -> "RIGHT"
      KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "SELECT"
      else -> null
    }

    if (keyName != null) {
      // ─── Consome o evento por completo (não repassa pro super) em vez de
      // só notificar o JS e deixar o Android também processar. Views focáveis
      // nativamente (como os Pressable, que ficam focáveis nessa combinação
      // de RN/Android mesmo sem pedir) respondem ao DPAD_CENTER/ENTER com um
      // "clique" automático do próprio sistema, disparando o onPress do
      // elemento em foco JUNTO com a nossa ponte — o toggle de rotação
      // simulada (e qualquer outro Pressable numa grade D-pad) acabava sendo
      // acionado duas vezes por um único aperto (liga, depois desliga na
      // sequência). Consumir aqui garante uma única fonte de verdade: só a
      // nossa navegação em JS decide o que "OK" faz.
      if (event.action == KeyEvent.ACTION_DOWN) emitDpadEvent(keyName)
      return true
    }

    return super.dispatchKeyEvent(event)
  }

  private fun emitDpadEvent(keyName: String) {
    try {
      val reactContext = reactHost?.currentReactContext ?: return
      val params = Arguments.createMap().apply { putString("key", keyName) }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(DPAD_EVENT_NAME, params)
    } catch (e: Exception) {
      // Bridge/JS ainda não pronto (ex: durante o boot) — ignora silenciosamente.
    }
  }
}
