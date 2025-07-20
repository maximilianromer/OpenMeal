declare module 'react-native-health-connect' {
  export type AccessType = 'read' | 'write';
  export interface Permission {
    accessType: AccessType;
    recordType: string;
  }

  export function initialize(): Promise<boolean>;
  export function requestPermission(permissions: Permission[]): Promise<Permission[]>;
  export function writeRecords(recordType: string, records: any[]): Promise<void>;
  export function readRecords(recordType: string, options: any): Promise<any>;
} 