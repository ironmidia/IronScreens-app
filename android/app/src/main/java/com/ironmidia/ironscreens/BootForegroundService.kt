package com.ironmidia.ironscreens

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

class BootForegroundService : Service() {

    companion object {
        private const val CHANNEL_ID = "boot_channel"
        private const val NOTIFICATION_ID = 1001
        private const val TAG = "IronScreens/BootFgSvc"

        // Alguns TV boxes ignoram startActivity() disparado muito cedo no boot
        // (SystemUI/launcher ainda não prontos). Tentamos algumas vezes com
        // atraso crescente antes de desistir; singleTask torna isso seguro
        // (nunca duplica a activity, só traz a existente pra frente).
        private val RETRY_DELAYS_MS = listOf(0L, 2000L, 5000L, 10000L)
    }

    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            startForeground(NOTIFICATION_ID, buildNotification())
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao promover a foreground", e)
        }

        RETRY_DELAYS_MS.forEach { delayMs ->
            handler.postDelayed({ launchMainActivity() }, delayMs)
        }

        handler.postDelayed({ stopSelf() }, RETRY_DELAYS_MS.last() + 1000L)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun launchMainActivity() {
        try {
            val launchIntent = Intent(applicationContext, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            applicationContext.startActivity(launchIntent)
            Log.i(TAG, "MainActivity lançada")
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao lançar MainActivity", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Iron Screens Boot",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Iniciando Iron Screens após o boot do dispositivo"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Iron Screens")
            .setContentText("Iniciando o aplicativo...")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build()
    }
}
