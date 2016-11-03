module.exports = function(RED)
{
	
    function dioRead(config) 
    {
        RED.nodes.createNode(this,config);
        var node = this;
        //libs
        var ffi = require('ffi');
        var dio = ffi.Library( __dirname + '/dioBridge.so', {
            "readDIO": ['int', ['string']]
        });
        //load config
        var ioPort = config.ioPort;
        var updateRate = config.updateRate;
        var ignoreFirst = config.ignoreFirst;
        var autoPolling = config.autoPolling;
        var pollingSpeed = Number(config.pollingSpeed);
        var enableEdgeMode = config.enableEdgeMode;
        var enableDebounce = config.enableDebounce;
        var risingEdgeDelay = Number(config.risingEdgeDelay);
        var fallingEdgeDelay = Number(config.fallingEdgeDelay);

        var lastRead = -1;
        var lastRead = parseInt(dio.readDIO(ioPort));
        var lastChanged = 0;
        var ioState = -1;
        var lastSend = -1;
        //new Date().getTime()


        //the result of first attemp to read io, show error if failed
        if(lastRead<0)
        {
            node.status({ fill: "red", shape:(autoPolling)?"ring":"dot", text: "IO Error" });
        }
        else
        {
            ioState = lastRead;
            lastSend = ioState;
            if(!ignoreFirst)
            {
                node.status({ fill: "green", shape:(autoPolling)?"ring":"dot", text: ioState });
                msg = {};
                msg.payload = ioState;
                node.send(msg);
            }
            else
            {
                node.status({ fill: "green", shape:(autoPolling)?"ring":"dot", text: ioState });
            }
        }

        function polling()
        {
            msg = {};
            // Only send ouput if ioRead success
            if(ioState >= 0)
            {
                if(enableEdgeMode)
                {
                    if(lastSend != ioState)
                    {
                        lastSend = ioState;
                        node.status({ fill: "green", shape: "ring", text: ioState });
                        msg.payload = ioState;
                        node.send(msg);
                    }
                }
                else
                {
                    node.status({ fill: "green", shape: "ring", text: ioState });
                    msg.payload = ioState;
                    node.send(msg);
                }
            }
        }

        function ioPolling()
        {
            msg = {};
            res = parseInt(dio.readDIO(ioPort));
            if(res < 0)
            {
                node.status({ fill: "red", shape:(autoPolling)?"ring":"dot", text: "IO Error" });
                ioState = -1;
            }
            else
            {
                if(lastRead != res)
                {
                    lastRead = res;
                    lastChanged = new Date().getTime();
                }

                // cond for rising and falling edge
                if(enableDebounce)
                {
                    debounceTime = (res>0)?risingEdgeDelay:fallingEdgeDelay;
                    if(new Date().getTime() - lastChanged > debounceTime)
                    {
                        if(ioState!=res)
                        {
                            ioState = res;
                        }
                    }
                }
                else
                {
                    if(ioState!=res)
                    {
                        ioState = res;
                    }
                }
            }
        }
        
        //only start polling if the test read successed
        if(autoPolling && (lastRead>=0))
            node.pollLoop = setInterval(polling, pollingSpeed);

        // iopool always runiing in background
        if(lastRead>=0)
            node.ioPollLop = setInterval(ioPolling, updateRate);
        
 
        node.on('input', function(msg)
        {
            if(ioState >= 0)
            {
                node.status({ fill: "green", shape: "dot", text: ioState });
                msg.payload = ioState;
                node.send(msg);
            }
        });
        
        node.on('close',function()
        {
            if(autoPolling)
                clearInterval(node.pollLoop);
            clearInterval(node.ioPollLop);
        });
    }
    RED.nodes.registerType("dio-read", dioRead);
}