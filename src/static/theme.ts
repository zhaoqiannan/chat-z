import { createTheme } from '@mantine/core';

const theme = createTheme({
  focusRing: 'always',
  scale: 0.16,
  colors: {
    deepBlue: [
      'rgba(0, 201, 255, 0)',
      'rgba(0, 201, 255, 0.17)',
      'rgba(0, 201, 255, 0.33)',
      'rgba(0, 201, 255, 0.50)',
      'rgba(0, 201, 255, 0.67)',
      'rgba(0, 201, 255, 0.83)',
      'rgba(0, 201, 255, 1)',
      'rgba(0, 201, 255, 1)',
      'rgba(0, 201, 255, 1)',
      'rgba(0, 201, 255, 1)'
    ],
  },
  primaryColor: 'deepBlue',
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


