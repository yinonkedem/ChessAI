import './Files.css'
import {getCharacter} from '../../../helper'

const Files = ({files, orientation}) =>
    <div className="files">
        {files.map(file => <span key={file}>{getCharacter(file)}</span>)}
    </div>

export default Files