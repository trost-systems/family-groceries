// Mail HTML still needs the attributes React's DOM types dropped: Outlook paints cell and table
// backgrounds from `bgcolor`, not from CSS alone.
import 'react';

declare module 'react' {
  interface TdHTMLAttributes<T> {
    bgcolor?: string;
  }
  interface TableHTMLAttributes<T> {
    bgcolor?: string;
  }
}
