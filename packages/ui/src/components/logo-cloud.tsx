import { InfiniteSlider, type InfiniteSliderProps } from '../components/motion-primitives/infinite-slider'
import { ProgressiveBlur } from '../components/motion-primitives/progressive-blur'
import { cn } from '../lib/utils';
import React from 'react'

export type LogoCloudConfig = {
    height?: HTMLImageElement['height'];
    width?: HTMLImageElement['width'];
    title?: string;
    logos?: Array<{
        url: HTMLImageElement['src'];
        alt: HTMLImageElement['alt'];
    }>
} & Omit<InfiniteSliderProps, 'children'>



const LogoCloud: React.FC<LogoCloudConfig> = ({
    title = "Powering the best teams",
    height = 20,
    logos = [
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/nvidia.svg",
            alt: "Nvidia Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/github.svg",
            alt: "GitHub Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/nike.svg",
            alt: "Nike Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/laravel.svg",
            alt: "Laravel Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg",
            alt: "OpenAI Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/typescript.svg",
            alt: "TypeScript Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/react.svg",
            alt: "React Logo"
        },
        {
            url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/vercel.svg",
            alt: "Vercel Logo"
        }
    ],
    width = "auto",
    className,
    ...rest
}) => {
    return (
        <section className={cn("bg-background overflow-hidden py-16", className)}>
            <div className="group relative m-auto max-w-7xl px-6">
                <div className="flex flex-col items-center md:flex-row">
                    <div className="md:max-w-44 md:border-r md:pr-6">
                        <p className="text-end text-sm">{title}</p>
                    </div>
                    <div className="relative py-6 md:w-[calc(100%-11rem)]">
                        <InfiniteSlider
                            speedOnHover={20}
                            speed={40}
                            gap={112}
                            {...rest}
                        >
                            {logos.map(({ alt, url }) => (
                                <div className="flex" key={url}>
                                    <img
                                        className="mx-auto h-5 w-fit dark:invert"
                                        src={url}
                                        alt={alt}
                                        height={height}
                                        width={width}
                                    />
                                </div>
                            ))}
                        </InfiniteSlider>

                        <div className="bg-linear-to-r from-background absolute inset-y-0 left-0 w-20"></div>
                        <div className="bg-linear-to-l from-background absolute inset-y-0 right-0 w-20"></div>
                        <ProgressiveBlur
                            className="pointer-events-none absolute left-0 top-0 h-full w-20"
                            direction="left"
                            blurIntensity={1}
                        />
                        <ProgressiveBlur
                            className="pointer-events-none absolute right-0 top-0 h-full w-20"
                            direction="right"
                            blurIntensity={1}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}

export default LogoCloud;