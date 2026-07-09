import { Fragment, type ReactNode } from 'react';

// Rich interpolation for dictionary strings whose placeholders are styled
// spans, not plain text (e.g. the lime Terms/Privacy links in auth.legal, the
// highlighted address in auth.sentBody). Word order differs across en/ru/sr,
// so the translation keeps the `{name}` markers and the call site supplies a
// ReactNode per marker. Render the result inside a parent <Text> so the plain
// string segments inherit its variant/color.

/** Split `template` on `{name}` markers and substitute the matching nodes. */
export function richTemplate(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((segment, index) => {
    const marker = /^\{(\w+)\}$/.exec(segment);
    if (marker && marker[1] in parts) {
      return <Fragment key={index}>{parts[marker[1]]}</Fragment>;
    }
    return <Fragment key={index}>{segment}</Fragment>;
  });
}
