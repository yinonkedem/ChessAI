import {getCharacter} from '../../../helpers'
import './Files.css'

const Files = ({files}) => {
    return <div className="files">
        {files.map(file => <span key={file}>{getCharacter(file)}</span>
        )}
    </div>
}

export default Files