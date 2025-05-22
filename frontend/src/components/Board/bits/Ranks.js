import './Ranks.css'

const Ranks = ({ranks, orientation}) =>
    <div className="ranks">
        {ranks.map(rank => <span key={rank}>{rank}</span>)}
    </div>

export default Ranks