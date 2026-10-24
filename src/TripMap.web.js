import { createElement, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { buildMapHtml } from "./mapHtml";

// Web build: react-native-webview isn't available, so render the same map page in an iframe.
export default function TripMap({ context, selectedRoute, hiddenKinds, height = 420 }) {
  const html = useMemo(
    () => buildMapHtml({ context, selectedRoute, hiddenKinds }),
    [context, selectedRoute, hiddenKinds]
  );

  return (
    <View style={[styles.frame, { height }]}>
      {createElement("iframe", {
        srcDoc: html,
        title: "Trip map",
        style: { border: 0, width: "100%", height: "100%" },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderRadius: 8, borderWidth: 1, borderColor: "#dfe4d8", backgroundColor: "#e8eddf" },
});
