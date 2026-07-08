using {AdminService} from './admin-service';

annotate AdminService with @requires: 'authenticated-user';
