import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { theme } from '../../lib/theme';
import type { CguBlock, CguContent } from './types';

type CGURendererProps = {
  content: CguContent;
};

export function CGURenderer({ content }: CGURendererProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>{content.pageTitle}</Text>
        <Text style={styles.date}>{content.effectiveDate}</Text>
      </View>

      {renderBlocks(content.blocks)}

      <Text style={styles.footer}>{content.footer}</Text>
    </ScrollView>
  );
}

function renderBlocks(blocks: CguBlock[]) {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'clause') {
      const clauseChildren: React.ReactNode[] = [
        <Text key={`clause-${i}`} style={styles.clauseText}>
          {block.text}
        </Text>
      ];
      i++;

      while (i < blocks.length && blocks[i].type === 'clauseBullet') {
        const bullet = blocks[i] as Extract<CguBlock, { type: 'clauseBullet' }>;
        clauseChildren.push(
          <Text key={`clause-bullet-${i}`} style={styles.clauseBullet}>
            {bullet.text}
          </Text>
        );
        i++;
      }

      elements.push(
        <View key={`clause-box-${i}`} style={styles.clauseBox}>
          {clauseChildren}
        </View>
      );
      continue;
    }

    switch (block.type) {
      case 'articleTitle':
        elements.push(<LegalArticleTitle key={`article-${i}`} title={block.text} />);
        break;
      case 'h2':
        elements.push(
          <Text key={`h2-${i}`} style={styles.h2}>
            {block.text}
          </Text>
        );
        break;
      case 'paragraph':
        elements.push(
          <Text key={`paragraph-${i}`} style={styles.paragraph}>
            {block.text}
          </Text>
        );
        break;
      case 'bullet':
        elements.push(
          <Text key={`bullet-${i}`} style={styles.bullet}>
            {block.text}
          </Text>
        );
        break;
      default:
        break;
    }

    i++;
  }

  return elements;
}

function LegalArticleTitle({ title }: { title: string }) {
  const [underlineWidth, setUnderlineWidth] = useState(0);
  return (
    <View style={styles.articleHeader}>
      <Text
        style={styles.articleTitle}
        onLayout={(e) => setUnderlineWidth(Math.ceil(e.nativeEvent.layout.width))}
      >
        {title}
      </Text>
      <View style={[styles.separator, { width: underlineWidth }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapLg * 2
  },
  header: {
    marginBottom: theme.spacing.gapLg
  },
  pageTitle: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.sectionLabel,
    marginTop: 4
  },
  articleHeader: {
    marginTop: theme.spacing.gapLg,
    marginBottom: theme.spacing.gapSm,
    alignSelf: 'flex-start',
    maxWidth: '100%'
  },
  articleTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary
  },
  separator: {
    marginTop: 8,
    height: 3,
    alignSelf: 'flex-start',
    width: 0,
    borderRadius: 999,
    backgroundColor: theme.colors.lime
  },
  h2: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.gapSm
  },
  paragraph: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginTop: 6
  },
  bullet: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginTop: 4,
    paddingLeft: 4
  },
  clauseBox: {
    marginTop: theme.spacing.gapSm,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: theme.spacing.gapSm
  },
  clauseText: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.bold
  },
  clauseBullet: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.bold,
    marginTop: 4
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.sectionLabel,
    textAlign: 'center',
    marginTop: theme.spacing.gapLg
  }
});
