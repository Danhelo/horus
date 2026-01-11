import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Dial } from '../../../components/mixer/Dial';
import {
  valueToAngle,
  angleToValue,
} from '../../../components/mixer/useDial';

describe('Dial', () => {
  const defaultProps = {
    id: 'test-dial',
    label: 'Test Dial',
    value: 0,
    polarity: 'bipolar' as const,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with correct label', () => {
      render(<Dial {...defaultProps} />);
      expect(screen.getByText('Test Dial')).toBeDefined();
    });

    it('renders with correct value display', () => {
      render(<Dial {...defaultProps} value={0.5} />);
      expect(screen.getByText('+0.50')).toBeDefined();
    });

    it('renders negative value with sign for bipolar', () => {
      render(<Dial {...defaultProps} value={-0.5} />);
      expect(screen.getByText('-0.50')).toBeDefined();
    });

    it('renders unipolar value without sign', () => {
      render(<Dial {...defaultProps} polarity="unipolar" value={0.5} />);
      expect(screen.getByText('0.50')).toBeDefined();
    });

    it('applies correct aria attributes', () => {
      render(<Dial {...defaultProps} value={0.5} />);
      const slider = screen.getByRole('slider');

      expect(slider.getAttribute('aria-label')).toBe('Test Dial');
      expect(slider.getAttribute('aria-valuenow')).toBe('0.5');
      expect(slider.getAttribute('aria-valuemin')).toBe('-1');
      expect(slider.getAttribute('aria-valuemax')).toBe('1');
    });

    it('applies disabled aria attribute when disabled', () => {
      render(<Dial {...defaultProps} disabled />);
      const slider = screen.getByRole('slider');

      expect(slider.getAttribute('aria-disabled')).toBe('true');
    });

    it('renders lock icon when locked', () => {
      const { container } = render(<Dial {...defaultProps} locked />);
      const lockOverlay = container.querySelector('.dial__lock-overlay');

      expect(lockOverlay).not.toBeNull();
    });

    it('applies data-dial-id attribute', () => {
      render(<Dial {...defaultProps} />);
      const slider = screen.getByRole('slider');

      expect(slider.getAttribute('data-dial-id')).toBe('test-dial');
    });
  });

  describe('sizes', () => {
    it('renders with small size', () => {
      const { container } = render(<Dial {...defaultProps} size="sm" />);
      const knob = container.querySelector('.dial__knob');

      expect(knob).not.toBeNull();
      expect(knob?.getAttribute('style')).toContain('width: 32px');
      expect(knob?.getAttribute('style')).toContain('height: 32px');
    });

    it('renders with medium size (default)', () => {
      const { container } = render(<Dial {...defaultProps} />);
      const knob = container.querySelector('.dial__knob');

      expect(knob).not.toBeNull();
      expect(knob?.getAttribute('style')).toContain('width: 48px');
      expect(knob?.getAttribute('style')).toContain('height: 48px');
    });

    it('renders with large size', () => {
      const { container } = render(<Dial {...defaultProps} size="lg" />);
      const knob = container.querySelector('.dial__knob');

      expect(knob).not.toBeNull();
      expect(knob?.getAttribute('style')).toContain('width: 64px');
      expect(knob?.getAttribute('style')).toContain('height: 64px');
    });
  });

  describe('keyboard controls', () => {
    it('increases value on ArrowUp', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      expect(onChange).toHaveBeenCalledWith(0.05);
    });

    it('decreases value on ArrowDown', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowDown' });

      expect(onChange).toHaveBeenCalledWith(-0.05);
    });

    it('increases value on ArrowRight', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowRight' });

      expect(onChange).toHaveBeenCalledWith(0.05);
    });

    it('decreases value on ArrowLeft', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowLeft' });

      expect(onChange).toHaveBeenCalledWith(-0.05);
    });

    it('sets to min on Home key', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0.5} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'Home' });

      expect(onChange).toHaveBeenCalledWith(-1);
    });

    it('sets to max on End key', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0.5} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'End' });

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('increases by 0.1 on PageUp', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'PageUp' });

      expect(onChange).toHaveBeenCalledWith(0.1);
    });

    it('decreases by 0.1 on PageDown', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'PageDown' });

      expect(onChange).toHaveBeenCalledWith(-0.1);
    });

    it('clamps value to max', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0.98} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('clamps value to min', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={-0.98} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowDown' });

      expect(onChange).toHaveBeenCalledWith(-1);
    });

    it('does not respond to keyboard when disabled', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} disabled />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not respond to keyboard when locked', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} locked />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('uses fine control with Shift key', () => {
      const onChange = vi.fn();
      render(<Dial {...defaultProps} value={0} onChange={onChange} />);
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });

      expect(onChange).toHaveBeenCalledWith(0.01);
    });
  });

  describe('double-click reset', () => {
    it('resets to default value on double click', () => {
      const onChange = vi.fn();
      render(
        <Dial {...defaultProps} value={0.75} defaultValue={0} onChange={onChange} />
      );
      const slider = screen.getByRole('slider');

      fireEvent.doubleClick(slider);

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it('resets to custom default value', () => {
      const onChange = vi.fn();
      render(
        <Dial {...defaultProps} value={0.75} defaultValue={0.25} onChange={onChange} />
      );
      const slider = screen.getByRole('slider');

      fireEvent.doubleClick(slider);

      expect(onChange).toHaveBeenCalledWith(0.25);
    });

    it('does not reset when disabled', () => {
      const onChange = vi.fn();
      render(
        <Dial
          {...defaultProps}
          value={0.75}
          defaultValue={0}
          onChange={onChange}
          disabled
        />
      );
      const slider = screen.getByRole('slider');

      fireEvent.doubleClick(slider);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not reset when locked', () => {
      const onChange = vi.fn();
      render(
        <Dial
          {...defaultProps}
          value={0.75}
          defaultValue={0}
          onChange={onChange}
          locked
        />
      );
      const slider = screen.getByRole('slider');

      fireEvent.doubleClick(slider);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('hover callback', () => {
    it('calls onHover with true on mouse enter', () => {
      const onHover = vi.fn();
      render(<Dial {...defaultProps} onHover={onHover} />);
      const slider = screen.getByRole('slider');

      fireEvent.mouseEnter(slider);

      expect(onHover).toHaveBeenCalledWith(true);
    });

    it('calls onHover with false on mouse leave', () => {
      const onHover = vi.fn();
      render(<Dial {...defaultProps} onHover={onHover} />);
      const slider = screen.getByRole('slider');

      fireEvent.mouseEnter(slider);
      fireEvent.mouseLeave(slider);

      expect(onHover).toHaveBeenLastCalledWith(false);
    });
  });

  describe('unipolar mode', () => {
    it('uses 0 to 1 range', () => {
      render(<Dial {...defaultProps} polarity="unipolar" value={0.5} />);
      const slider = screen.getByRole('slider');

      expect(slider.getAttribute('aria-valuemin')).toBe('0');
      expect(slider.getAttribute('aria-valuemax')).toBe('1');
    });

    it('clamps to 0 minimum', () => {
      const onChange = vi.fn();
      render(
        <Dial {...defaultProps} polarity="unipolar" value={0.02} onChange={onChange} />
      );
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowDown' });

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it('clamps to 1 maximum', () => {
      const onChange = vi.fn();
      render(
        <Dial {...defaultProps} polarity="unipolar" value={0.98} onChange={onChange} />
      );
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'ArrowUp' });

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('sets to 0 on Home key', () => {
      const onChange = vi.fn();
      render(
        <Dial {...defaultProps} polarity="unipolar" value={0.5} onChange={onChange} />
      );
      const slider = screen.getByRole('slider');

      fireEvent.keyDown(slider, { key: 'Home' });

      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe('CSS classes', () => {
    it('applies dial class by default', () => {
      const { container } = render(<Dial {...defaultProps} />);
      const element = container.firstChild as HTMLElement;
      expect(element?.className).toContain('dial');
    });

    it('applies dial--disabled class when disabled', () => {
      const { container } = render(<Dial {...defaultProps} disabled />);
      const element = container.firstChild as HTMLElement;
      expect(element?.className).toContain('dial--disabled');
    });

    it('applies dial--locked class when locked', () => {
      const { container } = render(<Dial {...defaultProps} locked />);
      const element = container.firstChild as HTMLElement;
      expect(element?.className).toContain('dial--locked');
    });

    it('does not apply dragging class initially', () => {
      const { container } = render(<Dial {...defaultProps} />);
      const element = container.firstChild as HTMLElement;
      expect(element?.className).not.toContain('dial--dragging');
    });
  });
});

describe('valueToAngle and angleToValue', () => {
  describe('bipolar', () => {
    it('converts -1 to -135 degrees', () => {
      expect(valueToAngle(-1, 'bipolar')).toBe(-135);
    });

    it('converts 0 to 0 degrees', () => {
      expect(valueToAngle(0, 'bipolar')).toBe(0);
    });

    it('converts 1 to 135 degrees', () => {
      expect(valueToAngle(1, 'bipolar')).toBe(135);
    });

    it('converts -135 degrees to -1', () => {
      expect(angleToValue(-135, 'bipolar')).toBe(-1);
    });

    it('converts 0 degrees to 0', () => {
      expect(angleToValue(0, 'bipolar')).toBe(0);
    });

    it('converts 135 degrees to 1', () => {
      expect(angleToValue(135, 'bipolar')).toBe(1);
    });
  });

  describe('unipolar', () => {
    it('converts 0 to -135 degrees', () => {
      expect(valueToAngle(0, 'unipolar')).toBe(-135);
    });

    it('converts 0.5 to 0 degrees', () => {
      expect(valueToAngle(0.5, 'unipolar')).toBe(0);
    });

    it('converts 1 to 135 degrees', () => {
      expect(valueToAngle(1, 'unipolar')).toBe(135);
    });

    it('converts -135 degrees to 0', () => {
      expect(angleToValue(-135, 'unipolar')).toBe(0);
    });

    it('converts 0 degrees to 0.5', () => {
      expect(angleToValue(0, 'unipolar')).toBe(0.5);
    });

    it('converts 135 degrees to 1', () => {
      expect(angleToValue(135, 'unipolar')).toBe(1);
    });
  });
});
