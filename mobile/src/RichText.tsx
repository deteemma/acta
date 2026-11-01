// Description mise en forme d'une action, lue en arbre par @app/shared
// (parseRichText) et affichée élément par élément : jamais interprétée.
import { parseRichText, type RichInline, TEXT } from '@app/shared';
import { Fragment } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { type AppTheme, useStyles } from './theme';
import { Text } from './ui';

export function RichText({ source }: { source: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.blocks}>
      {parseRichText(source).map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={i} style={[styles.heading, HEADING_SIZES[block.level]]} accessibilityRole="header">
                <Inlines nodes={block.content} />
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i}>
                {block.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && '\n'}
                    <Inlines nodes={line} />
                  </Fragment>
                ))}
              </Text>
            );
          case 'list':
            return (
              <View key={i}>
                {block.items.map((item, j) => (
                  <Text key={j}>
                    {block.ordered ? `${j + 1}. ` : '• '}
                    <Inlines nodes={item} />
                  </Text>
                ))}
              </View>
            );
        }
      })}
    </View>
  );
}

function Inlines({ nodes }: { nodes: RichInline[] }) {
  const styles = useStyles(makeStyles);
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'reference':
        return node.reference;
      case 'bold':
        return (
          <Text key={i} style={styles.bold}>
            <Inlines nodes={node.children} />
          </Text>
        );
      case 'italic':
        return (
          <Text key={i} style={styles.italic}>
            <Inlines nodes={node.children} />
          </Text>
        );
      case 'link':
        // Adresse déjà limitée à http, https et mailto par parseRichText.
        return (
          <Text key={i} style={styles.link} accessibilityRole="link" onPress={() => void Linking.openURL(node.href)}>
            {node.text}
          </Text>
        );
    }
  });
}

/** Titres de niveau 1 à 3 (## à ####), comme sur le web. */
const HEADING_SIZES: Record<number, { fontSize: number }> = {
  1: { fontSize: TEXT.panelTitle },
  2: { fontSize: TEXT.sectionTitle },
  3: { fontSize: TEXT.body },
};

const makeStyles = ({ colors, space, fonts }: AppTheme) =>
  StyleSheet.create({
    blocks: { gap: space[2] },
    heading: { fontFamily: fonts.bold },
    bold: { fontFamily: fonts.bold },
    italic: { fontStyle: 'italic' },
    link: { color: colors.accentStrong, textDecorationLine: 'underline' },
  });
