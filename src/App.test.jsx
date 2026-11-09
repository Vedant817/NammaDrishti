import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import {useMapEvents} from 'react-leaflet';

describe('NammaDrishti Core Platform Tests', () => {
  test('renders NammaDrishti header, branding, and city badge', () => {
    render(<App />);
    expect(screen.getByText('NammaDrishti')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
    expect(screen.getByText('Roads, rain & local reports')).toBeInTheDocument();
  });

  test('renders hazard filter chips and calculates active incidents', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab',{name:'Reports'}));
    expect(screen.getByText('All Hazards')).toBeInTheDocument();
    expect(screen.getAllByText('Traffic Jams').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Waterlogging').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Accidents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Road damage').length).toBeGreaterThan(0);
  });

  test('renders floating action buttons for reporting, AI, and Safe Route', () => {
    render(<App />);
    expect(screen.getAllByRole('button',{name:'Report a problem'}).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ask a question" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Plan a trip" })[0]).toBeInTheDocument();
  });

  test('switches sidebar tabs between Reports, Overview, and Helplines with Emergency SOS', () => {
    render(<App />);
    const helplineTab = screen.getByRole('tab',{name:'Help'});
    fireEvent.click(helplineTab);
    expect(screen.getByText(/Bengaluru Emergency Helplines/i)).toBeInTheDocument();
    expect(screen.getByText(/Share emergency location/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab',{name:'Today'}));
    const diagnosticTab = screen.getByRole('button',{name:/Rain & weather/});
    fireEvent.click(diagnosticTab);
    expect(screen.getByText(/Bengaluru overview/i)).toBeInTheDocument();
  });

  test('opens and closes report hazard modal', () => {
    render(<App />);
    const reportBtn = screen.getAllByRole('button',{name:'Report a problem'})[0];
    fireEvent.click(reportBtn);

    expect(screen.getByRole('heading',{name:'Report a problem'})).toBeInTheDocument();
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('heading',{name:'Report a problem'})).not.toBeInTheDocument();
  });

  test('opens and closes Safe Route transit navigation modal with Auto-Detour', () => {
    render(<App />);
    const routeBtn = screen.getAllByRole("button", { name: "Plan a trip" })[0];
    routeBtn.focus();
    fireEvent.click(routeBtn);

    expect(screen.getByRole('heading',{name:'Plan a trip'})).toBeInTheDocument();
    expect(screen.getByText(/Avoid reported floods/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Plan a trip' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(routeBtn).toHaveFocus();

    expect(screen.queryByRole('heading',{name:'Plan a trip'})).not.toBeInTheDocument();
  });

  test('map selection offers a report action without interrupting browsing',()=>{
    render(<App/>);
    act(()=>useMapEvents.mock.calls.at(-1)[0].click({latlng:{lat:12.97,lng:77.59}}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Map location selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Report here'}));
    expect(screen.getByRole('heading',{name:'Report a problem'})).toBeInTheDocument();
  });

  test('toggles language to Kannada and translates UI elements', () => {
    render(<App />);
    const select = screen.getByLabelText(/Select Language/i);
    fireEvent.change(select, { target: { value: 'kn' } });

    expect(screen.getByText('ಬೆಂಗಳೂರು')).toBeInTheDocument();
    expect(screen.getByText('ನೈಜ-ಸಮಯದ ನಾಗರಿಕ ಮತ್ತು ಸಂಚಾರ ಮಾಹಿತಿ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'ವರದಿಗಳು'}));
    expect(screen.getByText('ಎಲ್ಲಾ ಅಪಾಯಗಳು')).toBeInTheDocument();
  });
});
