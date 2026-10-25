import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Keyboard } from '../src/components/Keyboard';
import { Hangman, visibleParts } from '../src/components/Hangman';
import { WordDisplay } from '../src/components/WordDisplay';

describe('Components', () => {
  it('πληκτρολόγιο: 24 ελληνικά γράμματα, απενεργοποίηση χρησιμοποιημένων', () => {
    const onPick = vi.fn();
    render(<Keyboard correct={['Α']} incorrect={['Ω']} eliminated={['Ψ']} onPick={onPick} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(24);
    expect(screen.getByRole('button', { name: /^Α, σωστό/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /^Ω, λάθος/ })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: /^Β, διαθέσιμο/ }));
    expect(onPick).toHaveBeenCalledWith('Β');
  });
  it('φυσικό πληκτρολόγιο: ελληνικά, τονισμένα και λατινικά', () => {
    const onPick = vi.fn();
    render(<Keyboard correct={[]} incorrect={[]} eliminated={[]} onPick={onPick} />);
    fireEvent.keyDown(window, { key: 'ά' });
    fireEvent.keyDown(window, { key: 'u' });
    fireEvent.keyDown(window, { key: 'ς' });
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(['Α', 'Θ', 'Σ']);
  });
  it('κρεμάλα: ένα τμήμα ανά λάθος για κάθε μέγιστο αριθμό λαθών', () => {
    expect(visibleParts(0, 6)).toBe(4);
    expect(visibleParts(6, 6)).toBe(10);
    expect(visibleParts(0, 10)).toBe(0);
    expect(visibleParts(10, 10)).toBe(10);
    const { container } = render(<Hangman mistakes={2} maxMistakes={6} />);
    expect(container.querySelectorAll('path, circle')).toHaveLength(6);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('απομένουν 4');
  });
  it('η λέξη δεν εμφανίζεται πριν αποκαλυφθεί', () => {
    render(<WordDisplay mask={[null, 'Α', null]} word={null} status="playing" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('κενό, Α, κενό');
  });
});
