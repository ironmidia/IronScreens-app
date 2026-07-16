package com.ironmidia.ironscreens

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "IronScreens/BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i(TAG, "onReceive: action=$action")

        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            try {
                val serviceIntent = Intent(context, BootForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                Log.i(TAG, "BootForegroundService solicitado com sucesso")
            } catch (e: Exception) {
                // Alguns fabricantes restringem foreground services logo após o boot;
                // registramos para diagnosticar via logcat em campo, sem derrubar o receiver.
                Log.e(TAG, "Falha ao iniciar BootForegroundService", e)
            }
        }
    }
}
