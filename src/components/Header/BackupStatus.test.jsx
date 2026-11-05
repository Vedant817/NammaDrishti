import {render,screen} from '@testing-library/react';
import BackupStatus from './BackupStatus';
test('manual snapshot success does not claim scheduled cron delivery or reveal a private archive URL',()=>{
 render(<BackupStatus backup={{configured:true,health:'healthy',completedAt:Date.now(),lastCompletedTrigger:'manual',url:'https://private.example/secret',retentionStatus:'complete'}}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Current verified snapshot');
 expect(screen.getByText('Manual operation')).toBeInTheDocument();
 expect(screen.getByText(/does not prove that the scheduled cron ran/)).toBeInTheDocument();
 expect(document.body.innerText||document.body.textContent).not.toContain('private.example');
 expect(screen.getAllByText('Not yet observed').length).toBeGreaterThan(0);
});
test('moderators see retention failures even when the snapshot is current',()=>{
 render(<BackupStatus backup={{configured:true,health:'healthy',completedAt:Date.now(),retentionStatus:'failed'}}/>);
 expect(screen.getByRole('alert')).toBeInTheDocument();expect(screen.getByText('Failed; operator attention needed')).toBeInTheDocument();
});
