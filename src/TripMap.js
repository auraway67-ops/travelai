import { useMemo } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildMapHtml } from "./mapHtml";

export default function TripMap({ context, selectedRoute, hiddenKinds, height = 420 }) {
  const html = useMemo(
    () => buildMapHtml({ context, selectedRoute, hiddenKinds }),
    [context, selectedRoute, hiddenKinds]
  );

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        nestedScrollEnabled
        onOpenWindow={(event) => Linking.openURL(event.nativeEvent.targetUrl)}
        // "Open in Maps" links leave the map and open the phone's maps app or browser.
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith("http") && !request.url.includes("tile.openstreetmap.org") && !request.url.includes("unpkg.com")) {
            Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderRadius: 8, borderWidth: 1, borderColor: "#dfe4d8", backgroundColor: "#e8eddf" },
  web: { flex: 1, backgroundColor: "#e8eddf" },
});
