import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { searchPlaces } from "./services/geo";
import { COLORS } from "./theme";

// A text field that suggests real places as you type. Picking one keeps its
// coordinates, so the map doesn't have to look the name up again.
export default function PlaceInput({ value, onChangeText, onPick, placeholder, accessory }) {
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    const query = value.trim();
    if (!typed.current || query.length < 3) {
      setResults([]);
      return undefined;
    }
    let current = true;
    const timer = setTimeout(() => {
      searchPlaces(query)
        .then((found) => current && setResults(found))
        .catch(() => current && setResults([]));
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value]);

  function pick(place) {
    typed.current = false;
    setResults([]);
    onPick(place);
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={(text) => {
            typed.current = true;
            onChangeText(text);
          }}
          onFocus={() => setFocused(true)}
          // Delay so a tap on a suggestion lands before the list closes.
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          placeholderTextColor="#a3a9a1"
          style={styles.input}
          autoCorrect={false}
        />
        {accessory}
      </View>
      {focused && results.length > 0 && (
        <View style={styles.list}>
          {results.map((place, index) => (
            <Pressable
              key={`${place.lat},${place.lon},${index}`}
              onPress={() => pick(place)}
              style={({ pressed }) => [styles.item, index > 0 && styles.itemDivider, pressed && styles.pressed]}
            >
              <Text style={styles.name}>{place.name}</Text>
              {place.area ? <Text style={styles.area}>{place.area}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function FieldButton({ label, icon, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{icon}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.white, color: COLORS.ink, fontSize: 14 },
  list: { marginTop: 4, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.white, overflow: "hidden" },
  item: { paddingHorizontal: 13, paddingVertical: 10 },
  itemDivider: { borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  name: { color: COLORS.ink, fontSize: 14, fontWeight: "600" },
  area: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  button: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.white },
  buttonText: { color: COLORS.ink, fontSize: 18 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
