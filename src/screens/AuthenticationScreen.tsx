import { openBrowser } from "@swan-io/react-native-browser";
import * as React from "react";
import { Animated, ImageRequireSource, Platform, StyleSheet, View } from "react-native";
import { NavigationBar, StatusBar, StatusBarProps } from "react-native-bars";
import BootSplash, { Manifest } from "react-native-bootsplash";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { P, isMatching } from "ts-pattern";
import parseUrl from "url-parse";
import { Button } from "../components/Button";
import { colors } from "../constants/colors";
import { useAnimatedValue } from "../hooks/useAnimatedValue";
import { Storage } from "../modules/Storage";
import { handleErrorWithAlert } from "../states/alerts";
import { setAuthentication } from "../states/authentication";
import { env } from "../utils/env";
import { t } from "../utils/i18n";
import { isNotNullish } from "../utils/nullish";

const LOGO = require("../assets/bootsplash/logo.png") as ImageRequireSource;
const MANIFEST = require("../assets/bootsplash/manifest.json") as Manifest;

const hasSessionToken = isMatching({
  sessionToken: P.string,
});

const styles = StyleSheet.create({
  bottom: {
    position: "absolute",
    padding: 32,
    backgroundColor: colors.white,
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});

export const AuthenticationScreen = () => {
  const translateY = useAnimatedValue(0);
  const insets = useSafeAreaInsets();

  // safe are inset + button height + top padding + spring leeway
  const bottomHeight = Math.max(insets.bottom, 16) + 128;

  const { container, logo } = BootSplash.useHideAnimation({
    manifest: MANIFEST,
    logo: LOGO,

    statusBarTranslucent: true,
    navigationBarTranslucent: true,

    animate: () => {
      const setSystemBarStyles = () => {
        NavigationBar.pushStackEntry({ barStyle: "dark-content" });
        StatusBar.pushStackEntry({ barStyle: "light-content" });
      };

      // A weird issue occurs on Android 12+ on app restart
      if (Platform.OS !== "android" || Platform.Version < 12) {
        setSystemBarStyles();
      } else {
        setTimeout(setSystemBarStyles, 500);
      }

      Animated.spring(translateY, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    },
  });

  const handleOnSignInPress = React.useCallback(() => {
    let entry: StatusBarProps | undefined;

    void openBrowser(`${env.API_HOST}/auth`, {
      dismissButtonStyle: "cancel",
      controlTintColor: colors.swan[900],
      barTintColor: colors.swan[50],

      onOpen: () => {
        entry = StatusBar.pushStackEntry({
          animated: true,
          barStyle:
            Platform.OS === "ios" && Number.parseInt(Platform.Version, 10) >= 13
              ? "light-content"
              : "dark-content",
        });
      },

      onClose: (url) => {
        if (isNotNullish(entry)) {
          StatusBar.popStackEntry(entry);
        }

        if (isNotNullish(url)) {
          const { protocol, host, query } = parseUrl(url, true);
          const origin = `${protocol}//${host}`;

          if (origin === env.DEEPLINK_CALLBACK_URL && hasSessionToken(query)) {
            Storage.setItem("sessionToken", query.sessionToken)
              .then(() => setAuthentication("user"))
              .catch((error: Error) => {
                handleErrorWithAlert(error);
              });
          }
        }
      },
    });
  }, []);

  const logoTranslateY = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(bottomHeight / 3)],
  });

  const bottomTranslateY = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [bottomHeight, 32],
  });

  return (
    <View {...container}>
      <Animated.Image
        {...logo}
        style={[logo.style, { transform: [{ translateY: logoTranslateY }] }]}
      />

      <Animated.View
        style={[
          styles.bottom,
          { height: bottomHeight, transform: [{ translateY: bottomTranslateY }] },
        ]}
      >
        <Button title={t("authenticationScreen.signInButton")} onPress={handleOnSignInPress} />
      </Animated.View>
    </View>
  );
};
