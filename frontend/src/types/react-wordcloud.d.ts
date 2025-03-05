declare module 'react-wordcloud' {
    interface Word {
        text: string;
        value: number;
        color?: string;
    }

    interface Options {
        rotations?: number;
        rotationAngles?: [number, number];
        fontSizes?: [number, number];
        padding?: number;
    }

    interface ReactWordcloudProps {
        words: Word[];
        options?: Options;
    }

    export default function ReactWordcloud(props: ReactWordcloudProps): JSX.Element;
} 