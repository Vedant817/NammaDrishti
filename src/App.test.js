import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('NammaDrishti Core Platform Tests', () => {
  test('renders NammaDrishti header, branding, and city badge', () => {
    render(<App />);
    expect(screen.getByText('NammaDrishti')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
    expect(screen.getByText('Roads, rain & local reports')).toBeInTheDocument();
  });

  test('renders hazard filter chips and calculates active incidents', () => {
    render(<App />);
    expect(screen.getByText('All Hazards')).toBeInTheDocument();
    expect(screen.getAllByText('Traffic Jams').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Waterlogging').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Accidents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Road damage').length).toBeGreaterThan(0);
  });

  test('renders floating action buttons for reporting, AI, and Safe Route', () => {
    render(<App />);
    expect(screen.getByText(/Report Hazard/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan route" })).toBeInTheDocument();
  });

  test('switches sidebar tabs between Reports, Overview, and Helplines with Emergency SOS', () => {
    render(<App />);
    const helplineTab = screen.getByText(/Helplines/i);
    fireEvent.click(helplineTab);
    expect(screen.getByText(/Bengaluru Emergency Helplines/i)).toBeInTheDocument();
    expect(screen.getByText(/Share emergency location/i)).toBeInTheDocument();

    const diagnosticTab = screen.getByRole("button", { name: "Overview" });
    fireEvent.click(diagnosticTab);
    expect(screen.getByText(/Bengaluru overview/i)).toBeInTheDocument();
  });

  test('opens and closes report hazard modal', () => {
    render(<App />);
    const reportBtn = screen.getByText(/Report Hazard/i);
    fireEvent.click(reportBtn);

    expect(screen.getByText('Report a hazard')).toBeInTheDocument();
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Report a hazard')).not.toBeInTheDocument();
  });

  test('opens and closes Safe Route transit navigation modal with Auto-Detour', () => {
    render(<App />);
    const routeBtn = screen.getByRole("button", { name: "Plan route" });
    routeBtn.focus();
    fireEvent.click(routeBtn);

    expect(screen.getByText('Plan a route')).toBeInTheDocument();
    expect(screen.getByText(/Avoid reported floods/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Plan a route' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(routeBtn).toHaveFocus();

    expect(screen.queryByText('Plan a route')).not.toBeInTheDocument();
  });

  test('toggles language to Kannada and translates UI elements', () => {
    render(<App />);
    const select = screen.getByLabelText(/Select Language/i);
    fireEvent.change(select, { target: { value: 'kn' } });

    expect(screen.getByText('ಬೆಂಗಳೂರು')).toBeInTheDocument();
    expect(screen.getByText('ನೈಜ-ಸಮಯದ ನಾಗರಿಕ ಮತ್ತು ಸಂಚಾರ ಮಾಹಿತಿ')).toBeInTheDocument();
    expect(screen.getByText('ಎಲ್ಲಾ ಅಪಾಯಗಳು')).toBeInTheDocument();
  });
});
