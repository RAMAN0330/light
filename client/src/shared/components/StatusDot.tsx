import React from 'react';
export function StatusDot(props: any){
    return React.createElement('span',{className:'status-dot',style:{background:props.color||'currentColor'}});
}