import { createTheme } from '@mantine/core';

const theme = createTheme({
  focusRing: 'always',
  scale: 0.16,
  colors: {
    brandCyan: [
      '#e0f7fc',
      '#b3effc',
      '#80e5fa',
      '#4ddbf7',
      '#1ad0f5',
      '#00bce5',
      '#00c9ff',
      '#00b2e0',
      '#0096bd',
      '#006c87'
    ],
  },
  primaryColor: 'brandCyan',
  components: {
    Text: {
      defaultProps: { size: 'sm' },
    },
    Button: {
      defaultProps: {
        size: 'md'
      },
      styles: {
        root: {}
      },
    },
  },
});
export default theme;


