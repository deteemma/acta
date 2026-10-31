// Description mise en forme d'une action, lue en arbre par @app/shared
// (parseRichText) et affichée élément par élément : jamais interprétée.
import { parseRichText, type RichInline } from '@app/shared';
import { Fragment } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

export function RichText({ source }: { source: string }) {
  return (
    <View style={styles.blocks}>
      {parseRichText(source).map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={i} style={[styles.heading, { fontSize: 22 - block.level * 2 }]} accessibilityRole="header">
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

const styles = StyleSheet.create({
  blocks: { gap: 8 },
  heading: { fontWeight: '700' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  link: { color: '#1565c0', textDecorationLine: 'underline' },
});
