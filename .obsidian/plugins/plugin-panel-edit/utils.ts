import { TFile, App } from 'obsidian';

//Generate a UUID
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

//Create a DOM node with properties
export function node(tag: keyof HTMLElementTagNameMap, properties?: any): HTMLElement {
    const element = document.createElement(tag);
    if (properties?.children) {
        for (const c of properties.children) element.appendChild(c);
    }
    if (properties?.class) {
        element.setAttribute('class', properties.class);
    }
    if (properties?.classes) {
        properties?.classes.forEach((c: string) => { element.classList.add(c); });
    }
    if (properties?.attributes) {
        for (const [k, v] of Object.entries(properties.attributes)) element.setAttribute(k, v as string);
    }
    if (properties?.text) {
        element.textContent = properties.text;
    }
    if (properties?.innerHTML) {
        element.innerHTML = properties.innerHTML;
    }
    if (properties?.style) {
        for (const [k, v] of Object.entries(properties.style)) element.style[k as any] = v as string;
    }
    if (properties?.listeners) {
        for (const [event, handler] of Object.entries(properties.listeners)) {
            element.addEventListener(event, handler as EventListener);
        }
    }
    return element;
}

//Check if two lines intersect
export function linesIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
): boolean {
    //Calculate direction of the lines
    const d1x = x2 - x1;
    const d1y = y2 - y1;
    const d2x = x4 - x3;
    const d2y = y4 - y3;
    
    //Calculate the determinant
    const det = d1x * d2y - d1y * d2x;
    
    //Lines are parallel if det is zero
    if (det === 0) return false;
    
    //Calculate the parameters t and s
    const t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / det;
    const s = ((x3 - x1) * d1y - (y3 - y1) * d1x) / det;
    
    //Check if the intersection point is on both line segments
    return t >= 0 && t <= 1 && s >= 0 && s <= 1;
}

//Calculate distance between two points
export function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

//Snap point to grid or angle
export function snapPoint(x: number, y: number, snapAngle: number, snapToGrid: boolean, gridSize: number): { x: number, y: number } {
    if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
    }
    return { x, y };
}

//Snap angle to nearest multiple of snapAngle
export function snapAngle(angle: number, snapAngle: number): number {
    return Math.round(angle / snapAngle) * snapAngle;
}

//Convert SVG path to clipping path for an image
export function svgPathToClipPath(path: string): string {
    return `path('${path}')`;
}

//Check if a point is inside a polygon
export function pointInPolygon(point: {x: number, y: number}, polygon: {x: number, y: number}[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) != (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

//Load image from path
export async function loadImage(app: App, path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            reject(new Error(`File not found: ${path}`));
            return;
        }
        
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
        img.src = app.vault.getResourcePath(file);
    });
}

//Get base folder for image selection
export function getImagesFolder(app: App): string {
    //Check if _Images folder exists
    const imagesFolder = app.vault.getAbstractFileByPath('_Images');
    if (imagesFolder) return '_Images';
    
    //Use vault root if _Images doesn't exist
    return '/';
}

//Get all image files in vault
export function getImageFiles(app: App): TFile[] {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
    return app.vault.getFiles().filter(file => 
        imageExtensions.includes(file.extension.toLowerCase())
    );
}

//Convert path data to points array
export function pathToPoints(path: string): {x: number, y: number}[] {
    const points: {x: number, y: number}[] = [];
    const pathCommands = path.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) || [];
    
    let currentPoint = {x: 0, y: 0};
    
    for (const command of pathCommands) {
        const type = command[0];
        const args = command.slice(1).trim().split(/[\s,]+/).map(Number);
        
        switch (type) {
            case 'M': //Move to (absolute)
                for (let i = 0; i < args.length; i += 2) {
                    currentPoint = {x: args[i], y: args[i+1]};
                    points.push({...currentPoint});
                }
                break;
            case 'm': //Move to (relative)
                for (let i = 0; i < args.length; i += 2) {
                    currentPoint = {
                        x: currentPoint.x + args[i],
                        y: currentPoint.y + args[i+1]
                    };
                    points.push({...currentPoint});
                }
                break;
            case 'L': //Line to (absolute)
                for (let i = 0; i < args.length; i += 2) {
                    currentPoint = {x: args[i], y: args[i+1]};
                    points.push({...currentPoint});
                }
                break;
            case 'l': //Line to (relative)
                for (let i = 0; i < args.length; i += 2) {
                    currentPoint = {
                        x: currentPoint.x + args[i],
                        y: currentPoint.y + args[i+1]
                    };
                    points.push({...currentPoint});
                }
                break;
            case 'H': //Horizontal line (absolute)
                for (let i = 0; i < args.length; i++) {
                    currentPoint = {x: args[i], y: currentPoint.y};
                    points.push({...currentPoint});
                }
                break;
            case 'h': //Horizontal line (relative)
                for (let i = 0; i < args.length; i++) {
                    currentPoint = {
                        x: currentPoint.x + args[i],
                        y: currentPoint.y
                    };
                    points.push({...currentPoint});
                }
                break;
            case 'V': //Vertical line (absolute)
                for (let i = 0; i < args.length; i++) {
                    currentPoint = {x: currentPoint.x, y: args[i]};
                    points.push({...currentPoint});
                }
                break;
            case 'v': //Vertical line (relative)
                for (let i = 0; i < args.length; i++) {
                    currentPoint = {
                        x: currentPoint.x,
                        y: currentPoint.y + args[i]
                    };
                    points.push({...currentPoint});
                }
                break;
            //For curves (C, c, S, s, Q, q, T, t, A, a), we'll add the endpoint
            case 'C': //Cubic Bezier (absolute)
                for (let i = 0; i < args.length; i += 6) {
                    currentPoint = {x: args[i+4], y: args[i+5]};
                    points.push({...currentPoint});
                }
                break;
            case 'c': //Cubic Bezier (relative)
                for (let i = 0; i < args.length; i += 6) {
                    currentPoint = {
                        x: currentPoint.x + args[i+4],
                        y: currentPoint.y + args[i+5]
                    };
                    points.push({...currentPoint});
                }
                break;
            case 'Z':
            case 'z': //Close path
                //If there are points and the first point is not the same as the current, add the first point
                if (points.length > 0 && 
                    (points[0].x !== currentPoint.x || points[0].y !== currentPoint.y)) {
                    currentPoint = {...points[0]};
                    points.push({...currentPoint});
                }
                break;
        }
    }
    
    return points;
}

//Convert points array to SVG path
export function pointsToPath(points: {x: number, y: number}[]): string {
    if (points.length === 0) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    //Close the path if there are at least 3 points
    if (points.length >= 3) {
        path += ' Z';
    }
    
    return path;
}

//Create a DOM SVG element with points
export function createSvgPath(points: {x: number, y: number}[], attributes?: any): SVGPathElement {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pointsToPath(points));
    
    if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            path.setAttribute(key, value as string);
        }
    }
    
    return path;
}