import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, AppThemeColors } from '@/constants/theme';
import {
  initAcademicCache,
  searchAcademicWithCache,
  autoCreateAcademic,
} from '@/services/academicSearch';

interface AcademicAutocompleteInputProps {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  type: 'university' | 'department';
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  hasError?: boolean;
  colors: AppThemeColors;
}

export function AcademicAutocompleteInput({
  label,
  iconName,
  type,
  value,
  onChangeText,
  placeholder,
  hasError,
  colors,
}: AcademicAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const cancelSearchRef = useRef<(() => void) | null>(null);

  // Initialize persistent cache once on mount
  useEffect(() => {
    initAcademicCache();
  }, []);

  // Update suggestions whenever text value changes or dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    if (cancelSearchRef.current) {
      cancelSearchRef.current();
    }

    const cancel = searchAcademicWithCache(
      type,
      value,
      (results, isRemote) => {
        setSuggestions(results);
        if (isRemote) {
          setIsSearchingRemote(false);
        }
      },
      () => {
        setIsSearchingRemote(true);
      }
    );

    cancelSearchRef.current = cancel;

    return () => {
      if (cancelSearchRef.current) {
        cancelSearchRef.current();
      }
    };
  }, [value, isOpen, type]);

  const handleSelect = (item: string) => {
    onChangeText(item);
    setIsOpen(false);
  };

  const handleCreateNew = async (newItem: string) => {
    const clean = newItem.trim();
    if (!clean) return;
    onChangeText(clean);
    setIsOpen(false);
    await autoCreateAcademic(type, clean);
  };

  const cleanVal = value.trim();
  const exactMatchExists = suggestions.some(
    (s) => s.toLowerCase() === cleanVal.toLowerCase()
  );
  const showCreateOption = cleanVal.length > 1 && !exactMatchExists;

  return (
    <View style={styles.container}>
      <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{label}</Text>

      {/* Input Field */}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor: hasError ? colors.error : colors.border,
          },
        ]}>
        <Ionicons name={iconName} size={18} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={(txt) => {
            onChangeText(txt);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />

        {/* Status indicator: search spinner or clear button or toggle */}
        {isSearchingRemote ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.iconBtn} />
        ) : value.length > 0 ? (
          <Pressable
            onPress={() => {
              onChangeText('');
              setIsOpen(true);
            }}
            hitSlop={8}
            style={styles.iconBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setIsOpen(!isOpen)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          {/* Header indicator */}
          <View style={[styles.dropdownHeader, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.dropdownHeaderText, { color: colors.textMuted }]}>
              {type === 'university' ? 'UNIVERSITIES & INSTITUTES' : 'COLLEGES & DEPARTMENTS'}
            </Text>
            <Pressable onPress={() => setIsOpen(false)} hitSlop={8}>
              <Text style={[styles.dropdownDoneText, { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>

          {/* Create New Option if user typed custom text not in DB */}
          {showCreateOption && (
            <Pressable
              onPress={() => handleCreateNew(cleanVal)}
              style={[
                styles.createOption,
                {
                  backgroundColor: colors.primaryBg,
                  borderBottomColor: colors.borderSubtle,
                },
              ]}>
              <Ionicons name="add-circle" size={18} color={colors.primary} />
              <View style={styles.createOptionTextWrapper}>
                <Text style={[styles.createOptionLabel, { color: colors.primary }]}>
                  Add & use new {type === 'university' ? 'University' : 'Department'}
                </Text>
                <Text style={[styles.createOptionValue, { color: colors.text }]} numberOfLines={1}>
                  &ldquo;{cleanVal}&rdquo;
                </Text>
              </View>
            </Pressable>
          )}

          {/* Suggestions List */}
          {suggestions.length === 0 && !showCreateOption ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No matching {type === 'university' ? 'universities' : 'departments'} found.
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Type the name above to auto-create and add it.
              </Text>
            </View>
          ) : (
            suggestions.slice(0, 8).map((item) => {
              const isSelected = item.toLowerCase() === cleanVal.toLowerCase();
              return (
                <Pressable
                  key={item}
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.itemRow,
                    { borderBottomColor: colors.borderSubtle },
                    isSelected && { backgroundColor: colors.cardSecondary },
                  ]}>
                  <Ionicons
                    name={type === 'university' ? 'school-outline' : 'business-outline'}
                    size={16}
                    color={isSelected ? colors.primary : colors.textMuted}
                    style={{ marginRight: 10 }}
                  />
                  <Text
                    style={[
                      styles.itemText,
                      { color: isSelected ? colors.primary : colors.text },
                      isSelected && styles.itemTextSelected,
                    ]}
                    numberOfLines={2}>
                    {item}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.primary}
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    position: 'relative',
    zIndex: 10,
  },
  inputLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  iconBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dropdownHeaderText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dropdownDoneText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    fontWeight: '600',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  createOptionTextWrapper: {
    flex: 1,
  },
  createOptionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
  createOptionValue: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    marginTop: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    flex: 1,
  },
  itemTextSelected: {
    fontFamily: Fonts.bodyBold,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
