import { render, screen, fireEvent } from '@testing-library/react';
import CustomMapContainer from './MapContainer';
test('traffic uses road tiles rather than hardcoded corridor lines and underpasses can be toggled independently', () => {
  render(<CustomMapContainer />);
  expect(screen.getAllByTestId('tile-layer')).toHaveLength(2);
  expect(screen.queryByTestId('polyline')).not.toBeInTheDocument();
  expect(screen.queryByTestId('circle-marker')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Map layers'));
  fireEvent.click(screen.getByRole('button', { name: 'Underpasses' }));
  expect(screen.getAllByTestId('circle-marker')).toHaveLength(11);
  fireEvent.click(screen.getByRole('button', { name: 'Underpasses' }));
  expect(screen.queryByTestId('circle-marker')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Traffic' }));
  expect(screen.getAllByTestId('tile-layer')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Report clusters' }));
  expect(screen.getByRole('status')).toHaveTextContent('No community reports yet');
});
