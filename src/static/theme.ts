import { BackgroundImage, Button, createTheme, MantineTheme, rem, Tabs, Title } from '@mantine/core';

const theme = createTheme({
  focusRing: 'always',
  scale: 0.16,
  fontFamily: '"Microsoft YaHei", "微软雅黑", Arial, Helvetica, sans-serif',
  black: '#1f2329',
  headings: {
    fontFamily: '"Microsoft YaHei", "微软雅黑", Arial, Helvetica, sans-serif',
    fontWeight: '600',
  },
  lineHeights: {
    xs: 'normal',
    sm: 'normal',
    md: 'normal',
    lg: 'normal',
    xl: 'normal'
  },

  colors: {
    blue: [
      '#e0f7fc',
      '#b3effc',
      '#80e5fa',
      '#4ddbf7',
      '#1ad0f5',
      '#00d2ff',
      '#00c9ff',
      '#00b2e0',
      '#0096bd',
      '#006c87'
    ],
  },
  primaryColor: 'blue',
  components: {
    SegmentedControl: {
      styles: {
        root: {
          background: '#f9f9fc'
        },
      }
    },
    Title: {
      styles: {
        root: {
          color: '#1F2329'
        },
      }
    },
    Text: {
      defaultProps: { size: 'sm' },
      styles: {
        root: {
          color: '#1F2329',
          lineHeight: 'normal',
        },
      }
    },
    Button: {
      defaultProps: {
        size: 'sm'
      },
      styles: {
        root: {
          lineHeight: 'normal',
        }
      },
    },
    Divider: {
      defaultProps: {
        color: '#eee'
      }
    },
  },
});
export default theme;
