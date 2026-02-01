import { ThemeProvider } from '@credopass/lib/theme';
import { Home } from './pages/Home';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <Home />
    </ThemeProvider>
  );
}
