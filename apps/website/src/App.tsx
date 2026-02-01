import { ThemeProvider } from '../../../packages/lib/src/theme';
import { Home } from './pages/Home';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <Home />
    </ThemeProvider>
  );
}
