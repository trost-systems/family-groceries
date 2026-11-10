// Mail HTML still needs the attributes React's DOM types dropped: Outlook paints cell and table
// backgrounds from `bgcolor`, not from CSS alone.
import 'react';

declare module 'react' {
  export interface TdHTMLAttributes<T> {
    bgcolor?: string;
  }
  export interface TableHTMLAttributes<T> {
    bgcolor?: string;
  }
}
