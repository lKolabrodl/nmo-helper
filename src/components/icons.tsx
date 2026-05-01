import React from 'react';

interface IIconProps {
	readonly size?: number;
	readonly className?: string;
}

const base = (size: number) => ({
	width: size,
	height: size,
	viewBox: '0 0 24 24',
	fill: 'none' as const,
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
});

export const IconBolt: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
	</svg>
);

export const IconGlobe: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<circle cx="12" cy="12" r="10"/>
		<path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>
	</svg>
);

export const IconBrain: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M9 3a3 3 0 0 0-3 3v.5a3 3 0 0 0-3 3v.5a3 3 0 0 0 1.5 2.6A3 3 0 0 0 6 18a3 3 0 0 0 3 3"/>
		<path d="M9 3v18M9 3a3 3 0 0 1 3 3M15 3a3 3 0 0 1 3 3v.5a3 3 0 0 1 3 3v.5a3 3 0 0 1-1.5 2.6A3 3 0 0 1 18 18a3 3 0 0 1-3 3"/>
		<path d="M15 3v18M15 3a3 3 0 0 0-3 3"/>
	</svg>
);

export const IconBug: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<rect x="8" y="6" width="8" height="14" rx="4"/>
		<path d="M8 12H4M16 12h4M8 8L5 5M16 8l3-3M8 16l-3 3M16 16l3 3M9 4a3 3 0 0 1 6 0"/>
	</svg>
);

export const IconCheck: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M20 6L9 17l-5-5"/>
	</svg>
);

export const IconClose: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M18 6L6 18M6 6l12 12"/>
	</svg>
);

export const IconWarn: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M12 2L2 21h20L12 2z"/>
		<path d="M12 9v5M12 17.5v.5"/>
	</svg>
);

export const IconChevronDown: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M6 9l6 6 6-6"/>
	</svg>
);

export const IconPlay: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className} fill="currentColor" stroke="none">
		<path d="M6 4l14 8-14 8V4z"/>
	</svg>
);

export const IconSearch: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<circle cx="11" cy="11" r="7"/>
		<path d="M21 21l-4.3-4.3"/>
	</svg>
);

export const IconRefresh: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M3 12a9 9 0 0 1 15.5-6.3M21 12a9 9 0 0 1-15.5 6.3"/>
		<path d="M19 3v5h-5M5 21v-5h5"/>
	</svg>
);

export const IconExpand: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
	</svg>
);

export const IconMinimize: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className}>
		<path d="M5 12h14"/>
	</svg>
);

export const IconStar: React.FC<IIconProps> = ({size = 14, className}) => (
	<svg {...base(size)} className={className} fill="currentColor" stroke="none">
		<path d="M12 2l3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.8l-6.3 3.3 1.2-6.9-5-4.9 7-1L12 2z"/>
	</svg>
);
