import { useKeyboardNavigation } from '../../hooks';

/**
 * Keyboard navigation controller component.
 * Must be placed inside the R3F Canvas to access the camera.
 */
export function KeyboardController() {
  useKeyboardNavigation();
  return null;
}
