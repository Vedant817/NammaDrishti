import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('NammaPulse Core Platform Tests', () => {
  test('renders NammaPulse header, branding, and city badge', () => {
    render(<App />);
    expect(screen.getByText('NammaPulse')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Civic & Traffic Intelligence')).toBeInTheDocument();
  });

  test('renders hazard filter chips and calculates active incidents', () => {
    render(<App />);
    expect(screen.getByText('All Hazards')).toBeInTheDocument();
    expect(screen.getByText('Traffic Jams')).toBeInTheDocument();
    expect(screen.getAllByText('Waterlogging').length).toBeGreaterThan(0);
    expect(screen.getByText('Accidents')).toBeInTheDocument();
    expect(screen.getByText('Potholes / Infra')).toBeInTheDocument();
  });

  test('renders floating action buttons for reporting and AI', () => {
    render(<App />);
    expect(screen.getByText(/Report Hazard/i)).toBeInTheDocument();
    expect(screen.getByText(/NammaPulse AI/i)).toBeInTheDocument();
  });

  test('switches sidebar tabs between Feed, Diagnostic, and Helplines', () => {
    render(<App />);
    const helplineTab = screen.getByText(/Helplines/i);
    fireEvent.click(helplineTab);
    expect(screen.getByText(/Bengaluru Emergency Helplines/i)).toBeInTheDocument();

    const diagnosticTab = screen.getByText(/Diagnostic/i);
    fireEvent.click(diagnosticTab);
    expect(screen.getByText(/Today's Bengaluru Diagnostic/i)).toBeInTheDocument();
  });

  test('opens and closes report hazard modal', () => {
    render(<App />);
    const reportBtn = screen.getByText(/Report Hazard/i);
    fireEvent.click(reportBtn);

    expect(screen.getByText('Report Civic or Traffic Incident')).toBeInTheDocument();
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Report Civic or Traffic Incident')).not.toBeInTheDocument();
  });
});
