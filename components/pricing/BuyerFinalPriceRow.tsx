import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';
import {
  formatBuyerFinalPrice
} from '../../lib/formatBuyerPrice';
import {
  BuyerPriceBreakdownSheet,
  BuyerPriceInfoButton
} from './BuyerPriceBreakdownSheet';

type BuyerFinalPriceRowProps = {
  itemPriceChf: number;
  currency?: string;
  /** Affiche le prix arrondi à l'entier (cartes horizontales). */
  round?: boolean;
  /** Style du libellé prix. */
  textStyle?: StyleProp<TextStyle>;
  /** Variante typo pour les cartes produit. */
  variant?: 'captionSm' | 'button' | 'h2';
  /** Affiche le bouton ⓘ et l'explication du prix (désactivé sur les cartes produit). */
  showInfoButton?: boolean;
  /** Limite le grossissement accessibilité (cartes à hauteur contrainte). */
  maxFontSizeMultiplier?: number;
};

export function BuyerFinalPriceRow({
  itemPriceChf,
  currency = 'CHF',
  round = false,
  textStyle,
  variant = 'captionSm',
  showInfoButton = true,
  maxFontSizeMultiplier
}: BuyerFinalPriceRowProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const safePrice = Number(itemPriceChf);
  const hasPrice = Number.isFinite(safePrice) && safePrice > 0;

  const label = hasPrice ? formatBuyerFinalPrice(safePrice, currency) : `0 ${currency}`;

  const openBreakdown = () => {
    if (!hasPrice) return;
    setShowBreakdown(true);
  };

  return (
    <>
      <View style={styles.row}>
        <Text
          variant={variant === 'h2' ? 'h2' : variant}
          color={variant === 'h2' ? 'appleBlack' : undefined}
          style={[styles.price, variant === 'h2' ? styles.priceLg : null, textStyle]}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {label}
        </Text>
        {hasPrice && showInfoButton ? <BuyerPriceInfoButton onPress={openBreakdown} /> : null}
      </View>

      {hasPrice && showInfoButton ? (
        <BuyerPriceBreakdownSheet
          visible={showBreakdown}
          onClose={() => setShowBreakdown(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    flexShrink: 1,
    minWidth: 0
  },
  price: {
    color: '#171819',
    fontFamily: theme.fontFamily.semiBold,
    flexShrink: 1
  },
  priceLg: {
    fontFamily: theme.fontFamily.bold
  }
});
