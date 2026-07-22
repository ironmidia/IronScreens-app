// Iron Screens — Vídeo próprio tocado via WebView (Native)
// Usado só quando a rotação simulada está ativa: o player nativo de vídeo
// (expo-video / VideoView) não respeita a rotação por transform nesse
// hardware mesmo com surfaceType="textureView" — mas o WebView (usado pro
// YouTube/Instagram) respeita certinho, porque é uma única camada de
// hardware que participa do pipeline normal de composição. Reaproveitamos
// esse mesmo mecanismo pra vídeos próprios (upload direto no sistema).
import React, { memo, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface WebVideoRendererProps {
  uri: string;
  durationSec?: number;
  onEnd?: () => void;
}

const DEFAULT_WATCHDOG_MS = 120000;
const END_MARGIN_MS = 500;

// ─── Sem uma baseUrl, o WebView carrega o HTML injetado como origem nula
// (opaca) — nessa origem, o Chromium bloqueia o <video> de carregar um
// arquivo local (file://) mesmo com allowFileAccess ativado, e o resultado
// é uma tela preta silenciosa (sem erro visível). Definir a baseUrl como a
// própria pasta do arquivo torna a página "mesma origem" do vídeo, o que
// libera o carregamento — tanto pra arquivo local quanto pra URL remota.
function getBaseUrl(uri: string): string {
  const idx = uri.lastIndexOf("/");
  return idx >= 0 ? uri.slice(0, idx + 1) : uri;
}

function buildHtml(uri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin:0; padding:0; background:#000; overflow:hidden; width:100%; height:100%; }
  .wrap { position:absolute; inset:0; width:100%; height:100%; background:#000; }
  /* O <video> em si fica escondido (1x1, invisível) — só existe pra decodificar
     os frames. O que aparece na tela é o <canvas>, desenhado manualmente a
     cada frame via drawImage. Isso é de propósito: a decodificação de vídeo
     nessa box parece usar uma sobreposição de hardware que ignora QUALQUER
     transform aplicado de fora (já tentamos SurfaceView→TextureView e
     hardware→software layer, nenhum resolveu) — um <canvas> é só um desenho
     2D comum, sem sobreposição nenhuma, então obrigatoriamente participa da
     composição normal da página e respeita a rotação, igual a qualquer outro
     elemento (o mesmo motivo pelo qual a faixa de rodapé já gira certo).
     Custa mais CPU (redesenha a cada frame), mas garante a rotação. */
  video { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
  canvas { position:absolute; inset:0; width:100%; height:100%; background:#000; }
</style>
</head>
<body>
  <div class="wrap">
    <video id="v" src="${uri}" autoplay muted playsinline webkit-playsinline crossorigin="anonymous"></video>
    <canvas id="c"></canvas>
  </div>
  <script>
    (function() {
      var v = document.getElementById('v');
      var c = document.getElementById('c');
      var ctx = c.getContext('2d');
      var endSent = false;
      var rafId = null;

      function send(obj) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch (e) {}
      }

      function notifyEnd() {
        if (endSent) return;
        endSent = true;
        if (rafId) cancelAnimationFrame(rafId);
        send({ type: 'ENDED' });
      }

      function resizeCanvas() {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
      }
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      function drawFrame() {
        if (v.readyState >= 2 && v.videoWidth && v.videoHeight) {
          var scale = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
          var dw = v.videoWidth * scale;
          var dh = v.videoHeight * scale;
          var dx = (c.width - dw) / 2;
          var dy = (c.height - dh) / 2;
          try { ctx.drawImage(v, dx, dy, dw, dh); } catch (e) {}
        }
        rafId = requestAnimationFrame(drawFrame);
      }

      v.addEventListener('ended', notifyEnd);
      v.addEventListener('error', function() {
        setTimeout(notifyEnd, 700);
      });
      v.addEventListener('loadedmetadata', function() {
        if (v.duration && isFinite(v.duration) && v.duration > 0) {
          send({ type: 'DURATION', value: v.duration });
        }
        resizeCanvas();
      });
      v.addEventListener('playing', function() {
        if (!rafId) drawFrame();
      });

      // Alguns WebViews exigem um play() explícito mesmo com autoplay+muted.
      var playPromise = v.play();
      if (playPromise && playPromise.catch) playPromise.catch(function() {});
    })();
  </script>
</body>
</html>`;
}

function WebVideoRenderer({ uri, durationSec, onEnd }: WebVideoRendererProps) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const endCalledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log("[WebVideoRenderer] Montando vídeo:", uri);
  }, [uri]);

  const triggerEnd = useCallback(() => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    console.log("[WebVideoRenderer] Avançando");
    onEndRef.current?.();
  }, []);

  const armWatchdog = useCallback((ms: number) => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    console.log("[WebVideoRenderer] Watchdog armado:", ms, "ms");
    watchdogRef.current = setTimeout(() => {
      console.warn("[WebVideoRenderer] Watchdog disparou, avançando");
      triggerEnd();
    }, ms);
  }, [triggerEnd]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "ENDED") {
          console.log("[WebVideoRenderer] ENDED recebido");
          triggerEnd();
        } else if (msg.type === "DURATION" && typeof msg.value === "number" && msg.value > 0) {
          console.log("[WebVideoRenderer] Duração real:", msg.value, "s");
          armWatchdog(msg.value * 1000 + END_MARGIN_MS);
        }
      } catch {
        if (e.nativeEvent.data === "ENDED") triggerEnd();
      }
    },
    [triggerEnd, armWatchdog],
  );

  const onLoadEnd = useCallback(() => {
    console.log("[WebVideoRenderer] onLoadEnd (documento HTML carregado)");
    // Watchdog de segurança inicial (substituído pelo real assim que
    // soubermos a duração real do vídeo via evento loadedmetadata).
    const fallbackMs =
      durationSec && durationSec > 0 ? durationSec * 1000 + END_MARGIN_MS : DEFAULT_WATCHDOG_MS;
    armWatchdog(fallbackMs);
  }, [durationSec, armWatchdog]);

  const onError = useCallback((e: any) => {
    console.error("[WebVideoRenderer] Erro no WebView:", e?.nativeEvent);
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: buildHtml(uri), baseUrl: getBaseUrl(uri) }}
        style={styles.webview}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onError}
        // ─── Removido androidLayerType="software": desligava a aceleração
        // por GPU do WebView inteiro, e como o desenho já é feito frame a
        // frame num <canvas> via requestAnimationFrame, cada frame acabava
        // sendo rasterizado por software — pesado o bastante pra causar
        // travamento constante nas boxes mais fracas. O <canvas> por si só
        // já resolve a rotação (é um desenho 2D comum, sem sobreposição de
        // hardware), então não precisa forçar software pra isso também.
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        // ─── O HTML é injetado inline (sem baseUrl de file://), então por
        // padrão o Chromium bloqueia o <video> de carregar um arquivo local
        // (file://) por política de origem — silenciosamente, sem aviso na
        // tela. Isso pode ser exatamente por que vídeos PRÓPRIOS (cacheados
        // em disco pro modo offline) não rodam certo com rotação simulada,
        // enquanto no teste isolado (URL remota, sem cache) funcionou.
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        allowsFullscreenVideo={false}
        originWhitelist={["*"]}
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
});

export default memo(WebVideoRenderer);
