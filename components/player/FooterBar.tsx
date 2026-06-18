// Iron Screens — Footer Bar Component
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import type { FooterBarConfig } from "@/hooks/useFooterBar";

const TICKER_SPEED = 80;
export const BAR_HEIGHT = 38;
const FONT_SIZE = 14;
const H_PADDING = 12;
const CLOCK_WIDTH = 180;
const ITEM_GAP = 80;

function formatClock(): string {
  const now = new Date();

  const date = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${date}  ${time}`;
}

function useClock(enabled: boolean): string {
  const [label, setLabel] = useState(() => (enabled ? formatClock() : ""));

  useEffect(() => {
    if (!enabled) {
      setLabel("");
      return;
    }

    setLabel(formatClock());
    const id = setInterval(() => setLabel(formatClock()), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return label;
}

interface ScrollTickerProps {
  text: string;
  textColor: string;
  bold: boolean;
  italic: boolean;
}

function ScrollTicker({ text, textColor, bold, italic }: ScrollTickerProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const displayText = useMemo(() => (text || "").trim(), [text]);
  const fontWeight = bold ? ("bold" as const) : ("500" as const);
  const fontStyle = italic ? ("italic" as const) : ("normal" as const);

  const stop = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  const start = useCallback(
    (measuredTextWidth: number, measuredContainerWidth: number) => {
      if (!displayText || measuredTextWidth <= 0 || measuredContainerWidth <= 0)
        return;

      stop();

      const fromX = measuredContainerWidth;
      const toX = -measuredTextWidth;
      const distance = fromX - toX;
      const duration = (distance / TICKER_SPEED) * 1000;

      translateX.setValue(fromX);

      const run = () => {
        animRef.current = Animated.timing(translateX, {
          toValue: toX,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        });

        animRef.current.start(({ finished }) => {
          if (!finished) return;
          translateX.setValue(fromX);
          run();
        });
      };

      run();
    },
    [displayText, stop, translateX],
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    stop();
    if (containerWidth > 0) {
      translateX.setValue(containerWidth);
    }
  }, [displayText, containerWidth, stop, translateX]);

  useEffect(() => {
    if (textWidth > 0 && containerWidth > 0) {
      start(textWidth, containerWidth);
    }
  }, [textWidth, containerWidth, start]);

  return (
    <View
      style={styles.tickerContainer}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0 && w !== containerWidth) {
          setContainerWidth(w);
        }
      }}
    >
      <View style={styles.measureLayer} pointerEvents="none">
        <Text
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w > 0 && w !== textWidth) {
              setTextWidth(w);
            }
          }}
          style={[
            styles.tickerText,
            {
              color: textColor,
              fontWeight,
              fontStyle,
            },
          ]}
        >
          {displayText}
        </Text>
      </View>

      {!!displayText && (
        <Animated.View
          style={[
            styles.singleTickerTrack,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="clip"
            style={[
              styles.tickerText,
              {
                color: textColor,
                fontWeight,
                fontStyle,
              },
            ]}
          >
            {displayText}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

interface Props {
  config: FooterBarConfig;
}

export default function FooterBar({ config }: Props) {
  const showClock = !!config.show_datetime;
  const clock = useClock(showClock);

  const bg = config.bg_color || "#1a1a1a";
  const tc = config.text_color || "#ffffff";
  const bold = !!(config as any).bold;
  const italic = !!(config as any).italic;

  const fontWeight = bold ? ("bold" as const) : ("500" as const);
  const fontStyle = italic ? ("italic" as const) : ("normal" as const);

  const logoUri = config.logo_url ?? undefined;
  const hasLogo = !!logoUri;
  const isScrollMode = config.mode === "scroll";

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      {hasLogo ? (
        <Image
          source={{ uri: logoUri }}
          style={styles.logo}
          resizeMode="contain"
        />
      ) : null}

      {hasLogo ? (
        <View
          style={[styles.divider, { backgroundColor: tc, opacity: 0.22 }]}
        />
      ) : null}

      <View style={styles.contentArea}>
        <View style={styles.messageArea}>
          {isScrollMode ? (
            <ScrollTicker
              text={config.text}
              textColor={tc}
              bold={bold}
              italic={italic}
            />
          ) : (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.fixedText,
                {
                  color: tc,
                  fontWeight,
                  fontStyle,
                },
              ]}
            >
              {config.text}
            </Text>
          )}
        </View>

        {showClock ? (
          <View style={styles.clockWrap}>
            <Text
              numberOfLines={1}
              style={[
                styles.clockText,
                {
                  color: tc,
                  fontWeight,
                  fontStyle,
                },
              ]}
            >
              {clock}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  singleTickerTrack: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: H_PADDING,
    zIndex: 50,
    elevation: 10,
  },

  logo: {
    width: 52,
    height: 20,
    flexShrink: 0,
  },

  divider: {
    width: 1,
    height: 16,
    marginLeft: 8,
    marginRight: 10,
    flexShrink: 0,
  },

  contentArea: {
    flex: 1,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  messageArea: {
    flex: 1,
    height: "100%",
    minWidth: 0,
    justifyContent: "center",
    overflow: "hidden",
  },

  tickerContainer: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    overflow: "hidden",
  },

  measureLayer: {
    position: "absolute",
    left: -10000,
    top: 0,
    opacity: 0,
  },

  tickerTrack: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  tickerText: {
    fontSize: FONT_SIZE,
    lineHeight: 18,
    letterSpacing: 0.2,
    includeFontPadding: false,
    ...(Platform.OS === "android"
      ? { textAlignVertical: "center" as const }
      : {}),
  },

  fixedText: {
    fontSize: FONT_SIZE,
    lineHeight: 18,
    letterSpacing: 0.2,
    includeFontPadding: false,
    ...(Platform.OS === "android"
      ? { textAlignVertical: "center" as const }
      : {}),
  },

  clockWrap: {
    width: CLOCK_WIDTH,
    height: "100%",
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "flex-end",
    flexShrink: 0,
  },

  clockText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    includeFontPadding: false,
    ...(Platform.OS === "android"
      ? { textAlignVertical: "center" as const }
      : {}),
  },
});
