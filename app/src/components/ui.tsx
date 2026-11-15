import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageStyle } from 'expo-image';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fuenteFoto } from '@/data/images';
import { color, font, radius, space, TOUCH } from '@/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export function Icon({ name, size = 20, tint = color.ink }: { name: IconName; size?: number; tint?: string }) {
  return <Ionicons name={name} size={size} color={tint} />;
}

export function Foto({ src, style, alt }: { src?: string; style: StyleProp<ImageStyle>; alt?: string }) {
  const source = fuenteFoto(src);
  if (!source) return <View style={[style as StyleProp<ViewStyle>, { backgroundColor: color.line }]} />;
  return <Image source={source} style={style} contentFit="cover" transition={150} accessibilityLabel={alt} />;
}

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  right,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  right?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonStyles[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        v.box,
        off && { backgroundColor: color.border, borderColor: color.border },
        pressed && !off && { opacity: 0.85 },
        right ? { justifyContent: 'space-between' } : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <>
          <View style={[styles.row, { flexShrink: 1 }]}>
            {icon ? <Icon name={icon} size={18} tint={off ? color.muted : v.text.color} /> : null}
            <Text
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}
              style={[styles.buttonText, v.text, { flexShrink: 1, textAlign: right ? 'left' : 'center' }, off && { color: color.muted }]}>
              {label}
            </Text>
          </View>
          {right ? (
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.buttonText, v.text, { fontWeight: '800', marginLeft: space.sm }, off && { color: color.muted }]}>
              {right}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const buttonStyles: Record<ButtonVariant, { box: ViewStyle; text: { color: string } }> = {
  primary: { box: { backgroundColor: color.brand, borderColor: color.brand }, text: { color: '#FFFFFF' } },
  dark: { box: { backgroundColor: color.ink, borderColor: color.ink }, text: { color: '#FFFFFF' } },
  outline: { box: { backgroundColor: color.surface, borderColor: color.border }, text: { color: color.ink } },
  ghost: { box: { backgroundColor: 'transparent', borderColor: 'transparent' }, text: { color: color.ink } },
  danger: { box: { backgroundColor: color.surface, borderColor: color.border }, text: { color: color.danger } },
};

export function BackButton({ icon = 'chevron-back' }: { icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.round}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <BackButton />
      <View style={{ flex: 1 }}>
        <Text style={font.h2} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={font.small} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={font.h2}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : null]}>
      <Text style={[styles.chipText, selected ? { color: '#FFFFFF', fontWeight: '700' } : null]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && { color: color.ink, fontWeight: '800' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** “+ Agregar” que se convierte en “− n +” con la leyenda “en tu pedido”. */
export function AddStepper({
  value,
  label,
  onAdd,
  onRemove,
  addLabel = '+ Agregar',
  compact,
}: {
  value: number;
  label?: string;
  onAdd: () => void;
  onRemove: () => void;
  addLabel?: string;
  compact?: boolean;
}) {
  if (value <= 0) {
    return (
      <Pressable accessibilityRole="button" onPress={onAdd} style={[styles.addBtn, compact && { alignSelf: 'stretch' }]}>
        <Text style={styles.addText}>{addLabel}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 2, alignSelf: compact ? 'stretch' : 'auto' }}>
      <View style={[styles.stepper, compact && { justifyContent: 'space-between', alignSelf: 'stretch' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar" onPress={onRemove} style={styles.stepBtn}>
          <Text style={styles.stepSign}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{label ?? value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Agregar" onPress={onAdd} style={styles.stepBtn}>
          <Text style={styles.stepSign}>+</Text>
        </Pressable>
      </View>
      {!compact ? <Text style={styles.inOrder}>en tu pedido</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'brand' | 'info' | 'warn' | 'danger' }) {
  const t = {
    neutral: [color.line, color.ink2],
    success: [color.successTint, '#166534'],
    brand: [color.brandTint, color.brandDark],
    info: [color.infoTint, '#1E3A8A'],
    warn: [color.warnTint, '#92400E'],
    danger: [color.dangerTint, '#991B1B'],
  }[tone];
  return (
    <View style={{ backgroundColor: t[0], borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: t[1], fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/**
 * Envuelve una pantalla con formulario para que el teclado no tape campos ni botones.
 * Desde SDK 54 Android es edge-to-edge: la ventana ya NO se achica sola con el teclado,
 * así que hay que usar `padding` en ambas plataformas.
 */
export function ConTeclado({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

export function Field({ label, hint, style, ...props }: ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={color.faint} style={[styles.input, style]} {...props} />
      {hint ? <Text style={font.tiny}>{hint}</Text> : null}
    </View>
  );
}

export function Radio({ selected }: { selected: boolean }) {
  return <View style={[styles.radio, selected && styles.radioOn]} />;
}

export function Notice({ tone = 'warn', title, text }: { tone?: 'warn' | 'info' | 'success' | 'danger'; title?: string; text: string }) {
  const t = { warn: [color.warnTint, '#78350F'], info: [color.infoTint, '#1E3A8A'], success: ['#ECFDF5', '#065F46'], danger: [color.dangerTint, '#7F1D1D'] }[tone];
  return (
    <View style={{ backgroundColor: t[0], borderRadius: radius.md, padding: 14, gap: 4 }}>
      {title ? <Text style={{ color: t[1], fontWeight: '800', fontSize: 14 }}>{title}</Text> : null}
      <Text style={{ color: t[1], fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 6 }}>
      <Text style={font.title}>{title}</Text>
      {text ? <Text style={[font.small, { textAlign: 'center' }]}>{text}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  round: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: color.surface },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space.xl, paddingTop: 22, paddingBottom: 10 },
  chip: { minHeight: 38, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.surface, justifyContent: 'center' },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  chipText: { fontSize: 14, fontWeight: '600', color: color.ink2 },
  segmented: { flexDirection: 'row', backgroundColor: '#ECE8E3', borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: color.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '600', color: color.ink2 },
  addBtn: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.brand, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  addText: { color: color.brand, fontWeight: '700', fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderRadius: radius.pill, backgroundColor: color.brand },
  stepBtn: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  stepSign: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  stepValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  inOrder: { fontSize: 11, fontWeight: '700', color: color.brandDark },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: color.ink2 },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 16, fontSize: 16, color: color.ink, backgroundColor: color.surface },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.faint },
  radioOn: { borderWidth: 7, borderColor: color.brand },
});
