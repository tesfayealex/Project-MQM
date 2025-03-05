declare module 'react-tagcloud' {
    interface CloudTag {
        value: string;
        count: number;
        color?: string;
        key?: string | number;
        [key: string]: any;
    }

    interface TagCloudProps {
        tags: CloudTag[];
        minSize?: number;
        maxSize?: number;
        shuffle?: boolean;
        colorOptions?: {
            luminosity?: 'light' | 'dark' | 'bright';
            hue?: string;
        };
        disableRandomColor?: boolean;
        renderer?: (tag: CloudTag, size: number, color: string) => JSX.Element;
        className?: string;
        onClick?: (tag: CloudTag) => void;
    }

    export function TagCloud(props: TagCloudProps): JSX.Element;
} 