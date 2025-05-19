type T = {
    full_size_url: string;
    thumbnail_url: string;
}

interface ThumbnailProps<T> {
    image: T;
    idx: number;
    setSelectedImage: (item: T) => void;
}


const ImageThumbnail = <T extends { thumbnail_url: string }>(props: ThumbnailProps<T>) => {
    return (
        <img
            key={props.idx}
            className="thumbnail"
            src={props.image.thumbnail_url}
            alt={`Photo ${props.idx + 1}`}
            style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
            onClick={() => props.setSelectedImage(props.image)}
        />)
}

export default ImageThumbnail;
